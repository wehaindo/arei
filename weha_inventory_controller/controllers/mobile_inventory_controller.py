# -*- coding: utf-8 -*-

import json
import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from odoo import http
from odoo.http import request, Response
import werkzeug.wrappers

_logger = logging.getLogger(__name__)


class MobileInventoryController(http.Controller):
    """
    HTTP Controller for Mobile Inventory Operations
    Handles Receipt, Delivery, and Internal Transfer operations
    """

    def _cors_preflight_response(self):
        """Handle OPTIONS preflight requests"""
        origin = request.httprequest.headers.get('Origin', '*')
        headers = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
        }
        return Response(status=200, headers=headers)

    def _apply_cors_headers(self, response):
        """Apply CORS headers to response"""
        origin = request.httprequest.headers.get('Origin', '*')
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept, Authorization'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

    def _generate_token(self, db, user_id):
        """Generate a secure token for user"""
        # Generate random token
        token = secrets.token_urlsafe(32)
        
        # Store token in ir.config_parameter with expiry (90 days)
        expiry = datetime.now() + timedelta(days=90)
        token_key = f'mobile_auth_token_{token}'
        
        token_data = {
            'user_id': user_id,
            'db': db,
            'expiry': expiry.isoformat(),
        }
        
        # Store in database
        request.env['ir.config_parameter'].sudo().set_param(
            token_key,
            json.dumps(token_data)
        )
        
        _logger.info(f"Generated token for user {user_id}: {token[:10]}...")
        return token

    def _validate_token(self, token):
        """Validate token and return user_id if valid"""
        try:
            token_key = f'mobile_auth_token_{token}'
            token_data_json = request.env['ir.config_parameter'].sudo().get_param(token_key)
            
            if not token_data_json:
                _logger.warning(f"Token not found: {token[:10]}...")
                return False
            
            token_data = json.loads(token_data_json)
            expiry = datetime.fromisoformat(token_data['expiry'])
            
            if datetime.now() > expiry:
                _logger.warning(f"Token expired: {token[:10]}...")
                # Delete expired token
                request.env['ir.config_parameter'].sudo().search([
                    ('key', '=', token_key)
                ]).unlink()
                return False
            
            _logger.info(f"Token validated for user {token_data['user_id']}")
            return token_data['user_id']
            
        except Exception as e:
            _logger.error(f"Token validation error: {str(e)}")
            return False

    def _handle_request(self, handler_func, require_auth=True):
        """Helper to handle OPTIONS preflight and POST requests with CORS"""
        # Handle OPTIONS preflight
        if request.httprequest.method == 'OPTIONS':
            return self._cors_preflight_response()
        
        try:
            # Validate token for authenticated endpoints
            if require_auth:
                auth_header = request.httprequest.headers.get('Authorization')
                _logger.info(f"Authorization header: {auth_header}")
                
                if not auth_header or not auth_header.startswith('Bearer '):
                    result = {'success': False, 'error': 'Missing or invalid authorization token'}
                    response = Response(
                        json.dumps(result),
                        status=401,
                        mimetype='application/json'
                    )
                    return self._apply_cors_headers(response)
                
                token = auth_header.replace('Bearer ', '')
                user_id = self._validate_token(token)
                
                if not user_id:
                    result = {'success': False, 'error': 'Invalid or expired token'}
                    response = Response(
                        json.dumps(result),
                        status=401,
                        mimetype='application/json'
                    )
                    return self._apply_cors_headers(response)
                
                # Set user context for this request
                request.uid = user_id
            
            # Parse JSON body for POST requests
            data = json.loads(request.httprequest.data) if request.httprequest.data else {}
            
            # Call the handler function
            result = handler_func(data)
            
            # Return response with CORS headers
            response = Response(
                json.dumps(result),
                status=200,
                mimetype='application/json'
            )
            return self._apply_cors_headers(response)
            
        except Exception as e:
            _logger.error(f"Request error: {str(e)}")
            result = {'success': False, 'error': str(e)}
            response = Response(
                json.dumps(result),
                status=500,
                mimetype='application/json'
            )
            return self._apply_cors_headers(response)

    def _authenticate_user(self, db, login, password):
        """Authenticate user and return user_id"""
        try:
            from odoo.http import db_list, db_filter
            import odoo
            
            _logger.info(f"Attempting authentication for user: {login} on database: {db}")
            
            # Close existing cursor if switching databases
            if request.db and request.db != db:
                request.env.cr.close()
            elif request.db:
                request.env.cr.rollback()
            
            # Verify database is accessible
            if not db_filter([db]):
                _logger.error(f"Database not found: {db}")
                return False
            
            # Authenticate using request.session (same as Odoo's web controller)
            credential = {'login': login, 'password': password, 'type': 'password'}
            auth_info = request.session.authenticate(db, credential)
            
            if auth_info and auth_info.get('uid'):
                uid = auth_info['uid']
                _logger.info(f"Authentication successful for user: {login} (uid: {uid})")
                
                # Ensure session is properly saved with database context
                request.session.db = db
                
                # Get registry and rotate session to ensure it's saved
                registry = odoo.modules.registry.Registry(db)
                with registry.cursor() as cr:
                    env = odoo.api.Environment(cr, uid, request.session.context)
                    # Rotate session to ensure it's properly saved
                    http.root.session_store.rotate(request.session, env)
                
                _logger.info(f"Session saved - DB: {request.session.db}, UID: {request.session.uid}")
                
                return uid
            else:
                _logger.warning(f"Authentication failed for user: {login}")
                return False
            
        except Exception as e:
            _logger.error(f"Authentication failed: {str(e)}")
            import traceback
            _logger.error(traceback.format_exc())
            return False

    # ==================== AUTHENTICATION ====================

    @http.route('/api/mobile/auth/login', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def mobile_login(self, **kwargs):
        """
        Mobile app login endpoint
        Expected params: db, login, password
        """
        # Handle preflight OPTIONS request
        if request.httprequest.method == 'OPTIONS':
            return self._cors_preflight_response()

        try:
            # Parse JSON body
            data = json.loads(request.httprequest.data.decode('utf-8'))
            _logger.info(f"Received login data: {data}")
            
            params = data.get('params', {})
            _logger.info(f"Extracted params: {params}")
            
            db = params.get('db')
            login = params.get('login')
            password = params.get('password')
            
            _logger.info(f"Login attempt - DB: {db}, Login: {login}")

            if not all([db, login, password]):
                result = {'success': False, 'error': 'Missing required parameters'}
                uid = None
            else:
                uid = self._authenticate_user(db, login, password)
                if uid:
                    # Generate token
                    token = self._generate_token(db, uid)
                    
                    user = request.env['res.users'].sudo().browse(uid)
                    result = {
                        'success': True,
                        'data': {
                            'user_id': uid,
                            'token': token,
                            'user_name': user.name,
                            'login': user.login,
                            'company_id': user.company_id.id,
                            'company_name': user.company_id.name,
                        }
                    }
                    _logger.info(f"Login successful for user {uid}, token generated")
                else:
                    result = {'success': False, 'error': 'Invalid credentials'}

            response = Response(
                json.dumps(result, default=str),
                status=200,
                mimetype='application/json'
            )
            
            return self._apply_cors_headers(response)

        except Exception as e:
            _logger.error(f"Login error: {str(e)}")
            result = {'success': False, 'error': str(e)}
            response = Response(
                json.dumps(result),
                status=500,
                mimetype='application/json'
            )
            return self._apply_cors_headers(response)

    # ==================== RECEIPT OPERATIONS ====================

    @http.route('/api/mobile/receipts/list', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def list_receipts(self, **kwargs):
        """
        List all pending receipts (incoming shipments)
        Optional filters: state, partner_id, date_from, date_to
        """
        def handler(data):
            domain = [('picking_type_code', '=', 'incoming')]
            
            state = data.get('state')
            if state:
                domain.append(('state', '=', state))
            
            partner_id = data.get('partner_id')
            if partner_id:
                domain.append(('partner_id', '=', int(partner_id)))
            
            date_from = data.get('date_from')
            if date_from:
                domain.append(('scheduled_date', '>=', date_from))
            
            date_to = data.get('date_to')
            if date_to:
                domain.append(('scheduled_date', '<=', date_to))

            pickings = request.env['stock.picking'].search(domain, order='scheduled_date desc')
            
            receipts = []
            for picking in pickings:
                receipts.append({
                    'id': picking.id,
                    'name': picking.name,
                    'partner_name': picking.partner_id.name if picking.partner_id else '',
                    'partner_id': picking.partner_id.id if picking.partner_id else False,
                    'scheduled_date': picking.scheduled_date.isoformat() if picking.scheduled_date else '',
                    'origin': picking.origin or '',
                    'state': picking.state,
                    'location_dest_id': picking.location_dest_id.id,
                    'location_dest_name': picking.location_dest_id.complete_name,
                    'total_lines': len(picking.move_ids_without_package),
                })

            return {
                'success': True,
                'data': receipts,
                'count': len(receipts)
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/receipts/<int:picking_id>', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def get_receipt_detail(self, picking_id, **kwargs):
        """Get detailed information about a specific receipt"""
        def handler(data):
            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Receipt not found'}

            lines = []
            for move in picking.move_ids_without_package:
                lines.append({
                    'id': move.id,
                    'product_id': move.product_id.id,
                    'product_name': move.product_id.name,
                    'product_code': move.product_id.default_code or '',
                    'product_barcode': move.product_id.barcode or '',
                    'quantity_expected': move.product_uom_qty,
                    'quantity_done': move.quantity_done,
                    'uom': move.product_uom.name,
                    'location_dest_id': move.location_dest_id.id,
                    'location_dest_name': move.location_dest_id.complete_name,
                    'state': move.state,
                })

            result_data = {
                'id': picking.id,
                'name': picking.name,
                'partner_name': picking.partner_id.name if picking.partner_id else '',
                'partner_id': picking.partner_id.id if picking.partner_id else False,
                'scheduled_date': picking.scheduled_date.isoformat() if picking.scheduled_date else '',
                'origin': picking.origin or '',
                'state': picking.state,
                'location_id': picking.location_id.id,
                'location_name': picking.location_id.complete_name,
                'location_dest_id': picking.location_dest_id.id,
                'location_dest_name': picking.location_dest_id.complete_name,
                'lines': lines,
            }

            return {'success': True, 'data': result_data}
        
        return self._handle_request(handler)

    @http.route('/api/mobile/receipts/<int:picking_id>/update', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def update_receipt_line(self, picking_id, **kwargs):
        """
        Update quantity done for a receipt line
        Expected params: move_id, quantity_done
        """
        def handler(data):
            move_id = data.get('move_id')
            quantity_done = data.get('quantity_done')

            if not move_id or quantity_done is None:
                return {'success': False, 'error': 'Missing required parameters'}

            move = request.env['stock.move'].browse(int(move_id))
            if not move.exists() or move.picking_id.id != picking_id:
                return {'success': False, 'error': 'Invalid move line'}

            move.write({'quantity_done': float(quantity_done)})

            return {
                'success': True,
                'message': 'Quantity updated successfully',
                'data': {
                    'move_id': move.id,
                    'quantity_done': move.quantity_done,
                }
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/receipts/<int:picking_id>/validate', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_receipt(self, picking_id, **kwargs):
        """Validate/Complete a receipt operation"""
        def handler(data):
            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Receipt not found'}

            if picking.state != 'assigned':
                return {'success': False, 'error': f'Receipt is in state {picking.state}, cannot validate'}

            # Validate the picking
            picking.button_validate()

            # Check if there's a backorder wizard
            if picking.state == 'assigned':
                # There might be a backorder situation
                return {
                    'success': True,
                    'message': 'Receipt validated with backorder',
                    'data': {'state': picking.state}
                }

            return {
                'success': True,
                'message': 'Receipt validated successfully',
                'data': {'state': picking.state}
            }
        
        return self._handle_request(handler)

    # ==================== DELIVERY OPERATIONS ====================

    @http.route('/api/mobile/deliveries/list', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def list_deliveries(self, **kwargs):
        """
        List all pending deliveries (outgoing shipments)
        Optional filters: state, partner_id, date_from, date_to
        """
        def handler(data):
            domain = [('picking_type_code', '=', 'outgoing')]
            
            state = data.get('state')
            if state:
                domain.append(('state', '=', state))
            
            partner_id = data.get('partner_id')
            if partner_id:
                domain.append(('partner_id', '=', int(partner_id)))
            
            date_from = data.get('date_from')
            if date_from:
                domain.append(('scheduled_date', '>=', date_from))
            
            date_to = data.get('date_to')
            if date_to:
                domain.append(('scheduled_date', '<=', date_to))

            pickings = request.env['stock.picking'].search(domain, order='scheduled_date desc')
            
            deliveries = []
            for picking in pickings:
                deliveries.append({
                    'id': picking.id,
                    'name': picking.name,
                    'partner_name': picking.partner_id.name if picking.partner_id else '',
                    'partner_id': picking.partner_id.id if picking.partner_id else False,
                    'scheduled_date': picking.scheduled_date.isoformat() if picking.scheduled_date else '',
                    'origin': picking.origin or '',
                    'state': picking.state,
                    'location_id': picking.location_id.id,
                    'location_name': picking.location_id.complete_name,
                    'total_lines': len(picking.move_ids_without_package),
                })

            return {
                'success': True,
                'data': deliveries,
                'count': len(deliveries)
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/deliveries/<int:picking_id>', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def get_delivery_detail(self, picking_id, **kwargs):
        """Get detailed information about a specific delivery"""
        def handler(data):
            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Delivery not found'}

            lines = []
            for move in picking.move_ids_without_package:
                lines.append({
                    'id': move.id,
                    'product_id': move.product_id.id,
                    'product_name': move.product_id.name,
                    'product_code': move.product_id.default_code or '',
                    'product_barcode': move.product_id.barcode or '',
                    'quantity_expected': move.product_uom_qty,
                    'quantity_done': move.quantity_done,
                    'uom': move.product_uom.name,
                    'location_id': move.location_id.id,
                    'location_name': move.location_id.complete_name,
                    'state': move.state,
                })

            result_data = {
                'id': picking.id,
                'name': picking.name,
                'partner_name': picking.partner_id.name if picking.partner_id else '',
                'partner_id': picking.partner_id.id if picking.partner_id else False,
                'scheduled_date': picking.scheduled_date.isoformat() if picking.scheduled_date else '',
                'origin': picking.origin or '',
                'state': picking.state,
                'location_id': picking.location_id.id,
                'location_name': picking.location_id.complete_name,
                'location_dest_id': picking.location_dest_id.id,
                'location_dest_name': picking.location_dest_id.complete_name,
                'lines': lines,
            }

            return {'success': True, 'data': result_data}
        
        return self._handle_request(handler)

    @http.route('/api/mobile/deliveries/<int:picking_id>/update', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def update_delivery_line(self, picking_id, **kwargs):
        """
        Update quantity done for a delivery line
        Expected params: move_id, quantity_done
        """
        def handler(data):
            move_id = data.get('move_id')
            quantity_done = data.get('quantity_done')

            if not move_id or quantity_done is None:
                return {'success': False, 'error': 'Missing required parameters'}

            move = request.env['stock.move'].browse(int(move_id))
            if not move.exists() or move.picking_id.id != picking_id:
                return {'success': False, 'error': 'Invalid move line'}

            move.write({'quantity_done': float(quantity_done)})

            return {
                'success': True,
                'message': 'Quantity updated successfully',
                'data': {
                    'move_id': move.id,
                    'quantity_done': move.quantity_done,
                }
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/deliveries/<int:picking_id>/validate', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_delivery(self, picking_id, **kwargs):
        """Validate/Complete a delivery operation"""
        def handler(data):
            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Delivery not found'}

            if picking.state != 'assigned':
                return {'success': False, 'error': f'Delivery is in state {picking.state}, cannot validate'}

            # Validate the picking
            picking.button_validate()

            return {
                'success': True,
                'message': 'Delivery validated successfully',
                'data': {'state': picking.state}
            }
        
        return self._handle_request(handler)

    # ==================== INTERNAL TRANSFER OPERATIONS ====================

    @http.route('/api/mobile/transfers/list', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def list_internal_transfers(self, **kwargs):
        """
        List all pending internal transfers
        Optional filters: state, date_from, date_to
        """
        def handler(data):
            domain = [('picking_type_code', '=', 'internal')]
            
            state = data.get('state')
            if state:
                domain.append(('state', '=', state))
            
            date_from = data.get('date_from')
            if date_from:
                domain.append(('scheduled_date', '>=', date_from))
            
            date_to = data.get('date_to')
            if date_to:
                domain.append(('scheduled_date', '<=', date_to))

            _logger.info(f"Searching internal transfers with domain: {domain}")
            pickings = request.env['stock.picking'].search(domain, order='scheduled_date desc')
            _logger.info(f"Found {len(pickings)} internal transfers")
            
            transfers = []
            for picking in pickings:
                transfers.append({
                    'id': picking.id,
                    'name': picking.name,
                    'scheduled_date': picking.scheduled_date.isoformat() if picking.scheduled_date else '',
                    'origin': picking.origin or '',
                    'state': picking.state,
                    'location_id': picking.location_id.id,
                    'location_name': picking.location_id.complete_name,
                    'location_dest_id': picking.location_dest_id.id,
                    'location_dest_name': picking.location_dest_id.complete_name,
                    'total_lines': len(picking.move_ids_without_package),
                })

            return {
                'success': True,
                'data': transfers,
                'count': len(transfers)
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/transfers/<int:picking_id>', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def get_transfer_detail(self, picking_id, **kwargs):
        """Get detailed information about a specific internal transfer"""
        def handler(data):
            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Transfer not found'}

            lines = []
            for move in picking.move_ids_without_package:
                lines.append({
                    'id': move.id,
                    'product_id': move.product_id.id,
                    'product_name': move.product_id.name,
                    'product_code': move.product_id.default_code or '',
                    'product_barcode': move.product_id.barcode or '',
                    'quantity_expected': move.product_uom_qty,
                    'quantity_done': move.quantity_done,
                    'uom': move.product_uom.name,
                    'location_id': move.location_id.id,
                    'location_name': move.location_id.complete_name,
                    'location_dest_id': move.location_dest_id.id,
                    'location_dest_name': move.location_dest_id.complete_name,
                    'state': move.state,
                })

            result_data = {
                'id': picking.id,
                'name': picking.name,
                'scheduled_date': picking.scheduled_date.isoformat() if picking.scheduled_date else '',
                'origin': picking.origin or '',
                'state': picking.state,
                'location_id': picking.location_id.id,
                'location_name': picking.location_id.complete_name,
                'location_dest_id': picking.location_dest_id.id,
                'location_dest_name': picking.location_dest_id.complete_name,
                'lines': lines,
            }

            return {'success': True, 'data': result_data}
        
        return self._handle_request(handler)

    @http.route('/api/mobile/transfers/<int:picking_id>/update', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def update_transfer_line(self, picking_id, **kwargs):
        """
        Update quantity done for a transfer line
        Expected params: move_id, quantity_done
        """
        def handler(data):
            move_id = data.get('move_id')
            quantity_done = data.get('quantity_done')

            if not move_id or quantity_done is None:
                return {'success': False, 'error': 'Missing required parameters'}

            move = request.env['stock.move'].browse(int(move_id))
            if not move.exists() or move.picking_id.id != picking_id:
                return {'success': False, 'error': 'Invalid move line'}

            move.write({'quantity_done': float(quantity_done)})

            return {
                'success': True,
                'message': 'Quantity updated successfully',
                'data': {
                    'move_id': move.id,
                    'quantity_done': move.quantity_done,
                }
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/transfers/<int:picking_id>/validate', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_transfer(self, picking_id, **kwargs):
        """Validate/Complete an internal transfer operation"""
        def handler(data):
            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Transfer not found'}

            if picking.state != 'assigned':
                return {'success': False, 'error': f'Transfer is in state {picking.state}, cannot validate'}

            # Validate the picking
            picking.button_validate()

            return {
                'success': True,
                'message': 'Transfer validated successfully',
                'data': {'state': picking.state}
            }
        
        return self._handle_request(handler)

    # ==================== PRODUCT SEARCH & BARCODE ====================

    @http.route('/api/mobile/products/search', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def search_products(self, **kwargs):
        """
        Search products by name, code, or barcode
        Expected params: query (search term), limit (optional)
        """
        def handler(data):
            query = data.get('query', '')
            limit = data.get('limit', 20)

            if not query:
                return {'success': False, 'error': 'Search query is required'}

            domain = [
                '|', '|',
                ('name', 'ilike', query),
                ('default_code', 'ilike', query),
                ('barcode', '=', query)
            ]

            products = request.env['product.product'].search(domain, limit=int(limit))

            products_data = []
            for product in products:
                products_data.append({
                    'id': product.id,
                    'name': product.name,
                    'code': product.default_code or '',
                    'barcode': product.barcode or '',
                    'uom': product.uom_id.name,
                    'qty_available': product.qty_available,
                    'type': product.type,
                })

            return {
                'success': True,
                'data': products_data,
                'count': len(products_data)
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/products/<int:product_id>/stock', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def get_product_stock(self, product_id, **kwargs):
        """
        Get stock levels for a product across locations
        Optional params: location_id (filter by specific location)
        """
        def handler(data):
            product = request.env['product.product'].browse(product_id)
            if not product.exists():
                return {'success': False, 'error': 'Product not found'}

            location_id = data.get('location_id')
            domain = [('product_id', '=', product_id)]
            
            if location_id:
                domain.append(('location_id', '=', int(location_id)))

            quants = request.env['stock.quant'].search(domain)

            stock_data = []
            for quant in quants:
                if quant.quantity > 0:  # Only show locations with stock
                    stock_data.append({
                        'location_id': quant.location_id.id,
                        'location_name': quant.location_id.complete_name,
                        'quantity': quant.quantity,
                        'reserved_quantity': quant.reserved_quantity,
                        'available_quantity': quant.quantity - quant.reserved_quantity,
                    })

            return {
                'success': True,
                'data': {
                    'product_id': product.id,
                    'product_name': product.name,
                    'product_code': product.default_code or '',
                    'total_available': product.qty_available,
                    'locations': stock_data
                }
            }
        
        return self._handle_request(handler)

    # ==================== LOCATIONS ====================

    @http.route('/api/mobile/locations/list', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def list_locations(self, **kwargs):
        """
        List available locations
        Optional params: usage (filter by usage type: internal, supplier, customer, etc.)
        """
        def handler(data):
            domain = []
            
            usage = data.get('usage')
            if usage:
                domain.append(('usage', '=', usage))
            else:
                domain.append(('usage', '=', 'internal'))  # Default to internal locations

            locations = request.env['stock.location'].search(domain, order='complete_name')

            locations_data = []
            for location in locations:
                locations_data.append({
                    'id': location.id,
                    'name': location.name,
                    'complete_name': location.complete_name,
                    'usage': location.usage,
                    'barcode': location.barcode or '',
                })

            return {
                'success': True,
                'data': locations_data,
                'count': len(locations_data)
            }
        
        return self._handle_request(handler)

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
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
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
        """Validate token and return token data if valid"""
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
            return token_data
            
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
                token_data = self._validate_token(token)
                
                if not token_data:
                    result = {'success': False, 'error': 'Invalid or expired token'}
                    response = Response(
                        json.dumps(result),
                        status=401,
                        mimetype='application/json'
                    )
                    return self._apply_cors_headers(response)
                
                # Update request environment with authenticated user
                user_id = token_data['user_id']
                db = token_data['db']
                request.update_env(user=user_id)
                _logger.info(f"Request authenticated for user {user_id}")
            
            # Parse JSON body for POST requests
            data = json.loads(request.httprequest.data) if request.httprequest.data else {}
            
            # Extract params from JSON-RPC style request
            if 'params' in data:
                data = data['params']
            
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

    # ==================== DASHBOARD ====================

    @http.route('/api/mobile/dashboard/stats', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def get_dashboard_stats(self, **kwargs):
        """
        Get dashboard statistics
        Returns aggregated data for today's operations, upcoming pickings, and pending operations
        """
        def handler(data):
            try:
                from datetime import date
                
                # Get today's date
                today = date.today()
                today_str = today.strftime('%Y-%m-%d')
                tomorrow = today + timedelta(days=1)
                tomorrow_str = tomorrow.strftime('%Y-%m-%d')
                
                # Get all pickings
                all_pickings = request.env['stock.picking'].search([])
                
                # Filter by picking types
                receipts = all_pickings.filtered(lambda p: p.picking_type_id.code == 'incoming')
                deliveries = all_pickings.filtered(lambda p: p.picking_type_id.code == 'outgoing')
                transfers = all_pickings.filtered(lambda p: p.picking_type_id.code == 'internal')
                
                # Today's operations
                today_receipts = receipts.filtered(
                    lambda p: p.scheduled_date and p.scheduled_date.date() == today
                )
                today_deliveries = deliveries.filtered(
                    lambda p: p.scheduled_date and p.scheduled_date.date() == today
                )
                today_transfers = transfers.filtered(
                    lambda p: p.scheduled_date and p.scheduled_date.date() == today
                )
                
                # Upcoming pickings (tomorrow and later)
                upcoming_pickings = all_pickings.filtered(
                    lambda p: p.scheduled_date and p.scheduled_date.date() >= tomorrow
                )
                
                # Pending operations (confirmed, waiting, assigned states)
                pending_states = ['confirmed', 'waiting', 'assigned']
                pending_receipts = receipts.filtered(lambda p: p.state in pending_states)
                pending_deliveries = deliveries.filtered(lambda p: p.state in pending_states)
                pending_transfers = transfers.filtered(lambda p: p.state in pending_states)
                
                # Count total products (optional - can be expensive for large datasets)
                # total_products = request.env['product.product'].search_count([('active', '=', True)])
                
                stats = {
                    'today_pickings': len(today_receipts) + len(today_deliveries) + len(today_transfers),
                    'today_receipts': len(today_receipts),
                    'today_deliveries': len(today_deliveries),
                    'today_transfers': len(today_transfers),
                    'next_pickings': len(upcoming_pickings),
                    'pending_receipts': len(pending_receipts),
                    'pending_deliveries': len(pending_deliveries),
                    'pending_transfers': len(pending_transfers),
                    'total_products': 0,  # Set to 0 to avoid performance impact
                }
                
                return {
                    'success': True,
                    'data': stats
                }
                
            except Exception as e:
                _logger.error(f"Dashboard stats error: {str(e)}")
                import traceback
                _logger.error(traceback.format_exc())
                return {
                    'success': False,
                    'error': str(e)
                }
        
        return self._handle_request(handler, require_auth=True)

    # ==================== UNIFIED STOCK PICKING OPERATIONS ====================

    @http.route('/api/mobile/operation-types', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def get_operation_types(self, **kwargs):
        """Get all available picking operation types"""
        def handler(data):
            picking_types = request.env['stock.picking.type'].search([
                ('active', '=', True)
            ], order='sequence, name')

            types_data = []
            for pt in picking_types:
                # Count pending pickings for this type (confirmed, waiting, assigned - ready to process)
                pending_count = request.env['stock.picking'].search_count([
                    ('picking_type_id', '=', pt.id),
                    ('state', 'in', ['confirmed', 'waiting', 'assigned'])
                ])

                types_data.append({
                    'id': pt.id,
                    'name': pt.name,
                    'code': pt.code,  # 'incoming', 'outgoing', 'internal'
                    'sequence': pt.sequence,
                    'color': pt.color,
                    'pending_count': pending_count,
                    'warehouse_id': pt.warehouse_id.id if pt.warehouse_id else None,
                    'warehouse_name': pt.warehouse_id.name if pt.warehouse_id else '',
                })

            return {
                'success': True,
                'data': types_data,
                'count': len(types_data)
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/pickings/list', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def list_pickings(self, **kwargs):
        """
        List stock pickings with optional filters
        Params: picking_type_id (optional), state (optional), date_from (optional), date_to (optional)
        """
        def handler(data):
            domain = []
            
            picking_type_id = data.get('picking_type_id')
            if picking_type_id:
                domain.append(('picking_type_id', '=', int(picking_type_id)))
            
            state = data.get('state')
            if state:
                domain.append(('state', '=', state))
            else:
                # Default: show confirmed, waiting, and assigned pickings (ready to process)
                # Exclude: draft (not ready), done (completed), cancel (cancelled)
                domain.append(('state', 'in', ['confirmed', 'waiting', 'assigned']))
            
            date_from = data.get('date_from')
            if date_from:
                domain.append(('scheduled_date', '>=', date_from))
            
            date_to = data.get('date_to')
            if date_to:
                domain.append(('scheduled_date', '<=', date_to))

            pickings = request.env['stock.picking'].search(
                domain, 
                order='scheduled_date desc, id desc',
                limit=100
            )

            pickings_data = []
            for picking in pickings:
                pickings_data.append({
                    'id': picking.id,
                    'name': picking.name,
                    'picking_type_id': picking.picking_type_id.id,
                    'picking_type_name': picking.picking_type_id.name,
                    'picking_type_code': picking.picking_type_id.code,
                    'partner_id': picking.partner_id.id if picking.partner_id else None,
                    'partner_name': picking.partner_id.name if picking.partner_id else '',
                    'scheduled_date': picking.scheduled_date.isoformat() if picking.scheduled_date else '',
                    'origin': picking.origin or '',
                    'state': picking.state,
                    'location_id': picking.location_id.id,
                    'location_name': picking.location_id.complete_name,
                    'location_dest_id': picking.location_dest_id.id,
                    'location_dest_name': picking.location_dest_id.complete_name,
                    'move_count': len(picking.move_ids_without_package),
                })

            return {
                'success': True,
                'data': pickings_data,
                'count': len(pickings_data)
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/pickings/<int:picking_id>', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def get_picking_detail(self, picking_id, **kwargs):
        """Get detailed information about a specific stock picking"""
        def handler(data):
            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Picking not found'}

            lines = []
            for move in picking.move_ids_without_package:
                # Calculate quantity_done from move_line_ids
                quantity_done = sum(move.move_line_ids.mapped('quantity'))
                
                # Get tracking type
                tracking = move.product_id.tracking or 'none'
                
                # Get move lines with lot information
                move_lines = []
                for ml in move.move_line_ids:
                    move_lines.append({
                        'id': ml.id,
                        'lot_id': ml.lot_id.id if ml.lot_id else None,
                        'lot_name': ml.lot_id.name if ml.lot_id else None,
                        'quantity': ml.quantity,
                    })
                
                lines.append({
                    'id': move.id,
                    'product_id': move.product_id.id,
                    'product_name': move.product_id.name,
                    'product_code': move.product_id.default_code or '',
                    'product_barcode': move.product_id.barcode or '',
                    'quantity_expected': move.product_uom_qty,
                    'quantity_done': quantity_done,
                    'uom': move.product_uom.name,
                    'location_id': move.location_id.id,
                    'location_name': move.location_id.complete_name,
                    'location_dest_id': move.location_dest_id.id,
                    'location_dest_name': move.location_dest_id.complete_name,
                    'state': move.state,
                    'tracking': tracking,
                    'move_lines': move_lines,
                })

            result_data = {
                'id': picking.id,
                'name': picking.name,
                'picking_type_id': picking.picking_type_id.id,
                'picking_type_name': picking.picking_type_id.name,
                'picking_type_code': picking.picking_type_id.code,
                'partner_id': picking.partner_id.id if picking.partner_id else None,
                'partner_name': picking.partner_id.name if picking.partner_id else '',
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

    @http.route('/api/mobile/pickings/<int:picking_id>/update', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def update_picking_line(self, picking_id, **kwargs):
        """
        Update quantity done for a picking line
        Expected params: move_id, quantity_done, lot_name (optional), lot_id (optional)
        """
        def handler(data):
            move_id = data.get('move_id')
            quantity_done = data.get('quantity_done')
            lot_name = data.get('lot_name')
            lot_id = data.get('lot_id')

            if not move_id or quantity_done is None:
                return {'success': False, 'error': 'Missing required parameters'}

            move = request.env['stock.move'].browse(int(move_id))
            if not move.exists() or move.picking_id.id != picking_id:
                return {'success': False, 'error': 'Invalid move line'}

            # Check tracking requirements
            tracking = move.product_id.tracking
            if tracking != 'none' and not lot_name and not lot_id:
                return {'success': False, 'error': f'Lot/Serial number is required for this product (tracking: {tracking})'}

            # Handle lot lookup only (don't create new lots)
            lot = None
            if lot_name or lot_id:
                if lot_id:
                    lot = request.env['stock.lot'].browse(int(lot_id))
                    if not lot.exists() or lot.product_id.id != move.product_id.id:
                        return {'success': False, 'error': 'Invalid lot/serial number'}
                elif lot_name:
                    # Search for existing lot only
                    lot = request.env['stock.lot'].search([
                        ('name', '=', lot_name),
                        ('product_id', '=', move.product_id.id)
                    ], limit=1)
                    
                    if not lot:
                        return {'success': False, 'error': f'Lot/Serial number "{lot_name}" not found for this product'}

            # For serial numbers, quantity must be 1
            qty = float(quantity_done)
            if tracking == 'serial' and qty != 1:
                qty = 1.0

            # Create a new move line with the lot
            request.env['stock.move.line'].create({
                'move_id': move.id,
                'product_id': move.product_id.id,
                'product_uom_id': move.product_uom.id,
                'location_id': move.location_id.id,
                'location_dest_id': move.location_dest_id.id,
                'quantity': qty,
                'picking_id': picking_id,
                'lot_id': lot.id if lot else None,
            })

            # Get updated quantity done
            updated_qty = sum(move.move_line_ids.mapped('quantity'))

            return {
                'success': True,
                'message': 'Quantity updated successfully',
                'data': {
                    'move_id': move.id,
                    'quantity_done': updated_qty,
                    'lot_name': lot.name if lot else None,
                    'lot_id': lot.id if lot else None,
                }
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/pickings/<int:picking_id>/scan', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def scan_picking_product(self, picking_id, **kwargs):
        """
        Scan a product barcode to add quantity to picking
        Expected params: barcode, lot_name (optional)
        """
        def handler(data):
            barcode = data.get('barcode')
            lot_name = data.get('lot_name')

            if not barcode:
                return {'success': False, 'error': 'Barcode is required'}

            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Picking not found'}

            # Search for product by barcode
            product = request.env['product.product'].search([('barcode', '=', barcode)], limit=1)
            
            # If not found as product, try as lot/serial number
            if not product:
                lot = request.env['stock.lot'].search([('name', '=', barcode)], limit=1)
                if lot:
                    product = lot.product_id
                    lot_name = lot.name  # Use the scanned lot
                else:
                    return {'success': False, 'error': 'Product or lot not found with this barcode'}

            # Find the move for this product
            move = picking.move_ids_without_package.filtered(lambda m: m.product_id.id == product.id)
            if not move:
                return {'success': False, 'error': 'Product not found in this picking'}

            move = move[0]  # Take first match

            # Check tracking requirements
            tracking = product.tracking
            if tracking != 'none' and not lot_name:
                return {'success': False, 'error': f'Lot/Serial number is required for this product (tracking: {tracking})'}

            # Handle lot lookup only (don't create new lots)
            lot = None
            if lot_name:
                # Search for existing lot only
                lot = request.env['stock.lot'].search([
                    ('name', '=', lot_name),
                    ('product_id', '=', product.id)
                ], limit=1)
                
                if not lot:
                    return {'success': False, 'error': f'Lot/Serial number "{lot_name}" not found for this product'}

            # Determine quantity (1 for serial, 1 for lot by default)
            qty = 1.0

            # Create a new move line
            request.env['stock.move.line'].create({
                'move_id': move.id,
                'product_id': product.id,
                'product_uom_id': move.product_uom.id,
                'location_id': move.location_id.id,
                'location_dest_id': move.location_dest_id.id,
                'quantity': qty,
                'picking_id': picking_id,
                'lot_id': lot.id if lot else None,
            })

            # Get updated quantity done
            updated_qty = sum(move.move_line_ids.mapped('quantity'))

            return {
                'success': True,
                'message': 'Product scanned successfully',
                'data': {
                    'product_id': product.id,
                    'product_name': product.name,
                    'move_id': move.id,
                    'quantity_done': updated_qty,
                    'lot_name': lot.name if lot else None,
                }
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/pickings/<int:picking_id>/scan-rfid', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def scan_rfid_tags(self, picking_id, **kwargs):
        """
        Process multiple RFID tags (lot numbers) for a picking
        Expected params: rfid_tags (array of EPC strings)
        
        Two modes:
        1. If lot exists in DB → validate and confirm (check if in picking)
        2. If lot is new → create lot and add new stock move line
        """
        def handler(data):
            rfid_tags = data.get('rfid_tags', [])

            if not rfid_tags or not isinstance(rfid_tags, list):
                return {'success': False, 'error': 'rfid_tags array is required'}

            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Picking not found'}

            results = []
            success_count = 0
            error_count = 0

            for epc in rfid_tags:
                try:
                    # Search for lot by EPC (lot name = EPC)
                    lot = request.env['stock.lot'].search([('name', '=', epc)], limit=1)
                    
                    if lot:
                        # MODE 1: Lot exists - validate and confirm
                        product = lot.product_id
                        if not product:
                            results.append({
                                'epc': epc,
                                'success': False,
                                'error': 'Lot has no product associated',
                                'mode': 'validate'
                            })
                            error_count += 1
                            continue

                        # Find the move for this product in the picking
                        move = picking.move_ids_without_package.filtered(
                            lambda m: m.product_id.id == product.id
                        )
                        
                        if not move:
                            results.append({
                                'epc': epc,
                                'success': False,
                                'error': f'Product "{product.name}" not found in this picking',
                                'mode': 'validate'
                            })
                            error_count += 1
                            continue

                        move = move[0]  # Take first match

                        # Check if this lot already has a move line in this picking
                        existing_line = request.env['stock.move.line'].search([
                            ('move_id', '=', move.id),
                            ('lot_id', '=', lot.id),
                            ('picking_id', '=', picking_id)
                        ], limit=1)

                        if existing_line:
                            # Already confirmed - mark as validated
                            results.append({
                                'epc': epc,
                                'success': True,
                                'product_name': product.name,
                                'product_id': product.id,
                                'lot_id': lot.id,
                                'message': 'Tag validated - already confirmed',
                                'mode': 'validate'
                            })
                            success_count += 1
                            continue

                        # Create a new move line with existing lot
                        request.env['stock.move.line'].sudo().create({
                            'move_id': move.id,
                            'product_id': product.id,
                            'product_uom_id': move.product_uom.id,
                            'location_id': move.location_id.id,
                            'location_dest_id': move.location_dest_id.id,
                            'quantity': 1.0,
                            'picking_id': picking_id,
                            'lot_id': lot.id,
                            'lot_name': lot.name,
                        })

                        results.append({
                            'epc': epc,
                            'success': True,
                            'product_name': product.name,
                            'product_id': product.id,
                            'lot_id': lot.id,
                            'lot_name': lot.name,
                            'message': 'Tag confirmed',
                            'mode': 'validate'
                        })
                        success_count += 1
                    
                    else:
                        # MODE 2: New lot - need to determine product and create lot + move line
                        # For manufacturing receipts, find a product that needs receiving
                        
                        # First try: Find moves with tracking (serial or lot) that have remaining quantity
                        tracked_moves = picking.move_ids_without_package.filtered(
                            lambda m: m.product_id.tracking in ['serial', 'lot'] and 
                            sum(m.move_line_ids.mapped('quantity')) < m.product_uom_qty
                        )
                        
                        if not tracked_moves:
                            # Try to find any move that needs receiving (even without tracking)
                            tracked_moves = picking.move_ids_without_package.filtered(
                                lambda m: sum(m.move_line_ids.mapped('quantity')) < m.product_uom_qty
                            )
                        
                        if not tracked_moves:
                            results.append({
                                'epc': epc,
                                'success': False,
                                'error': 'No products need receiving in this picking',
                                'mode': 'new'
                            })
                            error_count += 1
                            continue
                        
                        # Take the first move that needs receiving
                        move = tracked_moves[0]
                        product = move.product_id
                        
                        # Create new lot/serial number with sudo for permissions
                        new_lot = request.env['stock.lot'].sudo().create({
                            'name': epc,
                            'product_id': product.id,
                            'company_id': picking.company_id.id,
                        })
                        
                        # Ensure lot is committed
                        request.env.cr.commit()
                        
                        if not new_lot:
                            results.append({
                                'epc': epc,
                                'success': False,
                                'error': 'Failed to create lot/serial number',
                                'mode': 'new'
                            })
                            error_count += 1
                            continue
                        
                        # Create move line with new lot (1 qty per RFID tag)
                        move_line = request.env['stock.move.line'].sudo().create({
                            'move_id': move.id,
                            'product_id': product.id,
                            'product_uom_id': move.product_uom.id,
                            'location_id': move.location_id.id,
                            'location_dest_id': move.location_dest_id.id,
                            'quantity': 1.0,
                            'picking_id': picking_id,
                            'lot_id': new_lot.id,
                            'lot_name': new_lot.name,
                        })
                        
                        results.append({
                            'epc': epc,
                            'success': True,
                            'product_name': product.name,
                            'product_id': product.id,
                            'lot_id': new_lot.id,
                            'lot_name': new_lot.name,
                            'message': f'New tag added for {product.name}',
                            'mode': 'new'
                        })
                        success_count += 1

                except Exception as e:
                    results.append({
                        'epc': epc,
                        'success': False,
                        'error': str(e)
                    })
                    error_count += 1

            return {
                'success': True,
                'data': {
                    'results': results,
                    'success_count': success_count,
                    'error_count': error_count,
                    'total': len(rfid_tags)
                }
            }

        return self._handle_request(handler, **kwargs)

    @http.route('/api/mobile/pickings/<int:picking_id>/validate', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_picking(self, picking_id, **kwargs):
        """Validate/Complete a stock picking operation"""
        def handler(data):
            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Picking not found'}

            if picking.state not in ['confirmed', 'waiting', 'assigned']:
                return {'success': False, 'error': f'Picking is in state {picking.state}, cannot validate'}

            # If picking is confirmed or waiting, we need to check availability first
            if picking.state in ['confirmed', 'waiting']:
                picking.action_assign()
            
            # Validate the picking
            picking.button_validate()

            return {
                'success': True,
                'message': 'Picking validated successfully',
                'data': {'state': picking.state}
            }
        
        return self._handle_request(handler)

    # ==================== OLD SEPARATE ENDPOINTS (DEPRECATED) ====================
    # These endpoints are kept for backward compatibility but should be migrated to unified endpoints above

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
                # Calculate quantity_done from move_line_ids
                quantity_done = sum(move.move_line_ids.mapped('quantity'))
                
                # Get existing move lines with lot info
                move_lines_detail = []
                for ml in move.move_line_ids:
                    move_lines_detail.append({
                        'id': ml.id,
                        'lot_id': ml.lot_id.id if ml.lot_id else False,
                        'lot_name': ml.lot_id.name if ml.lot_id else ml.lot_name or '',
                        'quantity': ml.quantity,
                    })
                
                lines.append({
                    'id': move.id,
                    'product_id': move.product_id.id,
                    'product_name': move.product_id.name,
                    'product_code': move.product_id.default_code or '',
                    'product_barcode': move.product_id.barcode or '',
                    'quantity_expected': move.product_uom_qty,
                    'quantity_done': quantity_done,
                    'uom': move.product_uom.name,
                    'location_dest_id': move.location_dest_id.id,
                    'location_dest_name': move.location_dest_id.complete_name,
                    'state': move.state,
                    'tracking': move.product_id.tracking,
                    'move_lines': move_lines_detail,
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
        Expected params: move_id, quantity_done, lot_name (optional), lot_id (optional)
        """
        def handler(data):
            move_id = data.get('move_id')
            quantity_done = data.get('quantity_done')
            lot_name = data.get('lot_name', '')
            lot_id = data.get('lot_id')

            if not move_id or quantity_done is None:
                return {'success': False, 'error': 'Missing required parameters'}

            move = request.env['stock.move'].browse(int(move_id))
            if not move.exists() or move.picking_id.id != picking_id:
                return {'success': False, 'error': 'Invalid move line'}

            # Check if product requires lot/serial tracking
            if move.product_id.tracking != 'none' and not lot_name and not lot_id:
                return {'success': False, 'error': f'Lot/Serial number is required for product {move.product_id.name}'}

            # Find or create lot if lot_name is provided
            lot = None
            if lot_id:
                lot = request.env['stock.lot'].browse(int(lot_id))
            elif lot_name and move.product_id.tracking != 'none':
                # Search for existing lot
                lot = request.env['stock.lot'].search([
                    ('name', '=', lot_name),
                    ('product_id', '=', move.product_id.id),
                    ('company_id', 'in', [move.company_id.id, False])
                ], limit=1)
                
                # Create new lot if not found
                if not lot:
                    lot = request.env['stock.lot'].create({
                        'name': lot_name,
                        'product_id': move.product_id.id,
                        'company_id': move.company_id.id,
                    })

            # For serial tracking, quantity must be 1
            if move.product_id.tracking == 'serial' and float(quantity_done) != 1.0:
                return {'success': False, 'error': 'Quantity must be 1.0 for serial tracked products'}

            # Prepare move line values
            move_line_vals = {
                'move_id': move.id,
                'product_id': move.product_id.id,
                'product_uom_id': move.product_uom.id,
                'location_id': move.location_id.id,
                'location_dest_id': move.location_dest_id.id,
                'quantity': float(quantity_done),
                'picking_id': picking_id,
            }

            if lot:
                move_line_vals['lot_id'] = lot.id
            elif lot_name:
                move_line_vals['lot_name'] = lot_name

            # Create or update move lines
            if move.product_id.tracking == 'serial':
                # For serial numbers, always create new move line
                request.env['stock.move.line'].create(move_line_vals)
            else:
                # For lot tracking or no tracking, update existing or create new
                existing_line = move.move_line_ids.filtered(
                    lambda ml: ml.lot_id == lot if lot else not ml.lot_id
                )
                
                if existing_line:
                    existing_line[0].write({'quantity': float(quantity_done)})
                else:
                    request.env['stock.move.line'].create(move_line_vals)

            # Get updated quantity done
            updated_qty = sum(move.move_line_ids.mapped('quantity'))

            # Get all move lines for response
            move_lines_detail = []
            for ml in move.move_line_ids:
                move_lines_detail.append({
                    'id': ml.id,
                    'lot_id': ml.lot_id.id if ml.lot_id else False,
                    'lot_name': ml.lot_id.name if ml.lot_id else ml.lot_name or '',
                    'quantity': ml.quantity,
                })

            return {
                'success': True,
                'message': 'Quantity updated successfully',
                'data': {
                    'move_id': move.id,
                    'quantity_done': updated_qty,
                    'move_lines': move_lines_detail,
                }
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/receipts/<int:picking_id>/scan', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def scan_receipt_product(self, picking_id, **kwargs):
        """
        Scan product and lot/serial number for receipt
        Expected params: barcode (product or lot), lot_name (if entering manually)
        """
        def handler(data):
            barcode = data.get('barcode', '')
            lot_name = data.get('lot_name', '')
            
            if not barcode and not lot_name:
                return {'success': False, 'error': 'Barcode or lot name is required'}

            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Receipt not found'}

            # Try to find product by barcode
            product = request.env['product.product'].search([
                ('barcode', '=', barcode)
            ], limit=1)

            # If not product, check if it's a lot/serial number
            lot = None
            if not product and barcode:
                lot = request.env['stock.lot'].search([
                    ('name', '=', barcode)
                ], limit=1)
                if lot:
                    product = lot.product_id
            
            # Use lot_name if provided
            if lot_name and not lot:
                lot_search = request.env['stock.lot'].search([
                    ('name', '=', lot_name)
                ], limit=1)
                if lot_search:
                    lot = lot_search
                    if not product:
                        product = lot.product_id

            if not product:
                return {'success': False, 'error': 'Product not found for barcode/lot'}

            # Find matching move in the picking
            move = picking.move_ids_without_package.filtered(
                lambda m: m.product_id == product and m.state != 'done'
            )

            if not move:
                return {'success': False, 'error': f'No pending receipt for product {product.name}'}

            move = move[0]  # Take first matching move

            # Determine lot name to use
            lot_to_use = lot_name or (lot.name if lot else '')

            # Check if product requires lot tracking
            if move.product_id.tracking != 'none' and not lot_to_use:
                return {
                    'success': False,
                    'error': 'Lot/Serial number required',
                    'requires_lot': True,
                    'product': {
                        'id': product.id,
                        'name': product.name,
                        'tracking': product.tracking,
                    },
                    'move_id': move.id,
                }

            # For serial numbers, quantity is always 1
            quantity = 1.0 if move.product_id.tracking == 'serial' else 1.0

            # Call the update method
            update_data = {
                'move_id': move.id,
                'quantity_done': quantity,
                'lot_name': lot_to_use,
            }
            
            if lot:
                update_data['lot_id'] = lot.id

            result = self.update_receipt_line(picking_id, **{'data': update_data})
            
            return {
                'success': True,
                'message': 'Product scanned successfully',
                'data': {
                    'product': {
                        'id': product.id,
                        'name': product.name,
                        'code': product.default_code or '',
                        'tracking': product.tracking,
                    },
                    'lot_name': lot_to_use,
                    'quantity': quantity,
                    'move_id': move.id,
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
                # Calculate quantity_done from move_line_ids
                quantity_done = sum(move.move_line_ids.mapped('quantity'))
                
                lines.append({
                    'id': move.id,
                    'product_id': move.product_id.id,
                    'product_name': move.product_id.name,
                    'product_code': move.product_id.default_code or '',
                    'product_barcode': move.product_id.barcode or '',
                    'quantity_expected': move.product_uom_qty,
                    'quantity_done': quantity_done,
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

            # Update or create move lines with the quantity done
            if move.move_line_ids:
                # Update existing move line
                move.move_line_ids[0].write({'quantity': float(quantity_done)})
            else:
                # Create a new move line if none exists
                request.env['stock.move.line'].create({
                    'move_id': move.id,
                    'product_id': move.product_id.id,
                    'product_uom_id': move.product_uom.id,
                    'location_id': move.location_id.id,
                    'location_dest_id': move.location_dest_id.id,
                    'quantity': float(quantity_done),
                    'picking_id': picking_id,
                })

            # Get updated quantity done
            updated_qty = sum(move.move_line_ids.mapped('quantity'))

            return {
                'success': True,
                'message': 'Quantity updated successfully',
                'data': {
                    'move_id': move.id,
                    'quantity_done': updated_qty,
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
                # Calculate quantity_done from move_line_ids
                quantity_done = sum(move.move_line_ids.mapped('quantity'))
                
                # Get tracking type
                tracking = move.product_id.tracking or 'none'
                
                # Get move lines with lot information
                move_lines = []
                for ml in move.move_line_ids:
                    move_lines.append({
                        'id': ml.id,
                        'lot_id': ml.lot_id.id if ml.lot_id else None,
                        'lot_name': ml.lot_id.name if ml.lot_id else None,
                        'quantity': ml.quantity,
                    })
                
                lines.append({
                    'id': move.id,
                    'product_id': move.product_id.id,
                    'product_name': move.product_id.name,
                    'product_code': move.product_id.default_code or '',
                    'product_barcode': move.product_id.barcode or '',
                    'quantity_expected': move.product_uom_qty,
                    'quantity_done': quantity_done,
                    'uom': move.product_uom.name,
                    'location_id': move.location_id.id,
                    'location_name': move.location_id.complete_name,
                    'location_dest_id': move.location_dest_id.id,
                    'location_dest_name': move.location_dest_id.complete_name,
                    'state': move.state,
                    'tracking': tracking,
                    'move_lines': move_lines,
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
        Expected params: move_id, quantity_done, lot_name (optional), lot_id (optional)
        """
        def handler(data):
            move_id = data.get('move_id')
            quantity_done = data.get('quantity_done')
            lot_name = data.get('lot_name')
            lot_id = data.get('lot_id')

            if not move_id or quantity_done is None:
                return {'success': False, 'error': 'Missing required parameters'}

            move = request.env['stock.move'].browse(int(move_id))
            if not move.exists() or move.picking_id.id != picking_id:
                return {'success': False, 'error': 'Invalid move line'}

            # Check tracking requirements
            tracking = move.product_id.tracking
            if tracking != 'none' and not lot_name and not lot_id:
                return {'success': False, 'error': f'Lot/Serial number is required for this product (tracking: {tracking})'}

            # Handle lot lookup only (don't create new lots)
            lot = None
            if lot_name or lot_id:
                if lot_id:
                    lot = request.env['stock.lot'].browse(int(lot_id))
                    if not lot.exists() or lot.product_id.id != move.product_id.id:
                        return {'success': False, 'error': 'Invalid lot/serial number'}
                elif lot_name:
                    # Search for existing lot only
                    lot = request.env['stock.lot'].search([
                        ('name', '=', lot_name),
                        ('product_id', '=', move.product_id.id)
                    ], limit=1)
                    
                    if not lot:
                        return {'success': False, 'error': f'Lot/Serial number "{lot_name}" not found for this product'}

            # For serial numbers, quantity must be 1
            qty = float(quantity_done)
            if tracking == 'serial' and qty != 1:
                qty = 1.0

            # Create a new move line with the lot
            request.env['stock.move.line'].create({
                'move_id': move.id,
                'product_id': move.product_id.id,
                'product_uom_id': move.product_uom.id,
                'location_id': move.location_id.id,
                'location_dest_id': move.location_dest_id.id,
                'quantity': qty,
                'picking_id': picking_id,
                'lot_id': lot.id if lot else None,
            })

            # Get updated quantity done
            updated_qty = sum(move.move_line_ids.mapped('quantity'))

            return {
                'success': True,
                'message': 'Quantity updated successfully',
                'data': {
                    'move_id': move.id,
                    'quantity_done': updated_qty,
                    'lot_name': lot.name if lot else None,
                    'lot_id': lot.id if lot else None,
                }
            }
        
        return self._handle_request(handler)

    @http.route('/api/mobile/transfers/<int:picking_id>/scan', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def scan_transfer_product(self, picking_id, **kwargs):
        """
        Scan a product barcode to add quantity to transfer
        Expected params: barcode, lot_name (optional)
        """
        def handler(data):
            barcode = data.get('barcode')
            lot_name = data.get('lot_name')

            if not barcode:
                return {'success': False, 'error': 'Barcode is required'}

            picking = request.env['stock.picking'].browse(picking_id)
            if not picking.exists():
                return {'success': False, 'error': 'Transfer not found'}

            # Search for product by barcode
            product = request.env['product.product'].search([('barcode', '=', barcode)], limit=1)
            
            # If not found as product, try as lot/serial number
            if not product:
                lot = request.env['stock.lot'].search([('name', '=', barcode)], limit=1)
                if lot:
                    product = lot.product_id
                    lot_name = lot.name  # Use the scanned lot
                else:
                    return {'success': False, 'error': 'Product or lot not found with this barcode'}

            # Find the move for this product
            move = picking.move_ids_without_package.filtered(lambda m: m.product_id.id == product.id)
            if not move:
                return {'success': False, 'error': 'Product not found in this transfer'}

            move = move[0]  # Take first match

            # Check tracking requirements
            tracking = product.tracking
            if tracking != 'none' and not lot_name:
                return {'success': False, 'error': f'Lot/Serial number is required for this product (tracking: {tracking})'}

            # Handle lot lookup only (don't create new lots)
            lot = None
            if lot_name:
                # Search for existing lot only
                lot = request.env['stock.lot'].search([
                    ('name', '=', lot_name),
                    ('product_id', '=', product.id)
                ], limit=1)
                
                if not lot:
                    return {'success': False, 'error': f'Lot/Serial number "{lot_name}" not found for this product'}

            # Determine quantity (1 for serial, 1 for lot by default)
            qty = 1.0

            # Create a new move line
            request.env['stock.move.line'].create({
                'move_id': move.id,
                'product_id': product.id,
                'product_uom_id': move.product_uom.id,
                'location_id': move.location_id.id,
                'location_dest_id': move.location_dest_id.id,
                'quantity': qty,
                'picking_id': picking_id,
                'lot_id': lot.id if lot else None,
            })

            # Get updated quantity done
            updated_qty = sum(move.move_line_ids.mapped('quantity'))

            return {
                'success': True,
                'message': 'Product scanned successfully',
                'data': {
                    'product_id': product.id,
                    'product_name': product.name,
                    'move_id': move.id,
                    'quantity_done': updated_qty,
                    'lot_name': lot.name if lot else None,
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

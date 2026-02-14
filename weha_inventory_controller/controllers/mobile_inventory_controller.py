# -*- coding: utf-8 -*-

import json
import logging
from odoo import http
from odoo.http import request, Response
import werkzeug.wrappers

_logger = logging.getLogger(__name__)


class MobileInventoryController(http.Controller):
    """
    HTTP Controller for Mobile Inventory Operations
    Handles Receipt, Delivery, and Internal Transfer operations
    """

    def _get_cors_headers(self):
        """Get CORS headers for responses"""
        # Get the origin from the request header
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
            'Access-Control-Allow-Credentials': 'true',
        }

    def _authenticate_user(self, db, login, password):
        """Authenticate user and return user_id"""
        try:
            uid = request.session.authenticate(db, login, password)
            return uid
        except Exception as e:
            _logger.error(f"Authentication failed: {str(e)}")
            return False

    def _make_response(self, data, status=200):
        """Create JSON response with CORS headers"""
        response = Response(
            json.dumps(data, default=str),
            status=status,
            mimetype='application/json'
        )
        response.headers.update(self._get_cors_headers())
        return response

    def _error_response(self, message, status=400):
        """Create error response"""
        return self._make_response({
            'success': False,
            'error': message
        }, status=status)

    def _success_response(self, data, message="Success"):
        """Create success response"""
        return self._make_response({
            'success': True,
            'message': message,
            'data': data
        })

    # ==================== AUTHENTICATION ====================

    @http.route('/api/mobile/auth/login', type='json', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def mobile_login(self, **kwargs):
        """
        Mobile app login endpoint
        Expected params: db, login, password
        """
        try:
            db = kwargs.get('db')
            login = kwargs.get('login')
            password = kwargs.get('password')

            if not all([db, login, password]):
                return {'success': False, 'error': 'Missing required parameters'}

            uid = self._authenticate_user(db, login, password)
            if uid:
                user = request.env['res.users'].sudo().browse(uid)
                return {
                    'success': True,
                    'data': {
                        'user_id': uid,
                        'session_id': request.session.sid,
                        'user_name': user.name,
                        'company_id': user.company_id.id,
                        'company_name': user.company_id.name,
                    }
                }
            else:
                return {'success': False, 'error': 'Invalid credentials'}
        except Exception as e:
            _logger.error(f"Login error: {str(e)}")
            return {'success': False, 'error': str(e)}

    # ==================== RECEIPT OPERATIONS ====================

    @http.route('/api/mobile/receipts/list', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def list_receipts(self, **kwargs):
        """
        List all pending receipts (incoming shipments)
        Optional filters: state, partner_id, date_from, date_to
        """
        try:
            domain = [('picking_type_code', '=', 'incoming')]
            
            state = kwargs.get('state', 'assigned')
            if state:
                domain.append(('state', '=', state))
            
            partner_id = kwargs.get('partner_id')
            if partner_id:
                domain.append(('partner_id', '=', int(partner_id)))
            
            date_from = kwargs.get('date_from')
            if date_from:
                domain.append(('scheduled_date', '>=', date_from))
            
            date_to = kwargs.get('date_to')
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
        except Exception as e:
            _logger.error(f"List receipts error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/receipts/<int:picking_id>', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def get_receipt_detail(self, picking_id, **kwargs):
        """Get detailed information about a specific receipt"""
        try:
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

            data = {
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

            return {'success': True, 'data': data}
        except Exception as e:
            _logger.error(f"Get receipt detail error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/receipts/<int:picking_id>/update', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def update_receipt_line(self, picking_id, **kwargs):
        """
        Update quantity done for a receipt line
        Expected params: move_id, quantity_done
        """
        try:
            move_id = kwargs.get('move_id')
            quantity_done = kwargs.get('quantity_done')

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
        except Exception as e:
            _logger.error(f"Update receipt line error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/receipts/<int:picking_id>/validate', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_receipt(self, picking_id, **kwargs):
        """Validate/Complete a receipt operation"""
        try:
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
        except Exception as e:
            _logger.error(f"Validate receipt error: {str(e)}")
            return {'success': False, 'error': str(e)}

    # ==================== DELIVERY OPERATIONS ====================

    @http.route('/api/mobile/deliveries/list', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def list_deliveries(self, **kwargs):
        """
        List all pending deliveries (outgoing shipments)
        Optional filters: state, partner_id, date_from, date_to
        """
        try:
            domain = [('picking_type_code', '=', 'outgoing')]
            
            state = kwargs.get('state', 'assigned')
            if state:
                domain.append(('state', '=', state))
            
            partner_id = kwargs.get('partner_id')
            if partner_id:
                domain.append(('partner_id', '=', int(partner_id)))
            
            date_from = kwargs.get('date_from')
            if date_from:
                domain.append(('scheduled_date', '>=', date_from))
            
            date_to = kwargs.get('date_to')
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
        except Exception as e:
            _logger.error(f"List deliveries error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/deliveries/<int:picking_id>', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def get_delivery_detail(self, picking_id, **kwargs):
        """Get detailed information about a specific delivery"""
        try:
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

            data = {
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

            return {'success': True, 'data': data}
        except Exception as e:
            _logger.error(f"Get delivery detail error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/deliveries/<int:picking_id>/update', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def update_delivery_line(self, picking_id, **kwargs):
        """
        Update quantity done for a delivery line
        Expected params: move_id, quantity_done
        """
        try:
            move_id = kwargs.get('move_id')
            quantity_done = kwargs.get('quantity_done')

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
        except Exception as e:
            _logger.error(f"Update delivery line error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/deliveries/<int:picking_id>/validate', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_delivery(self, picking_id, **kwargs):
        """Validate/Complete a delivery operation"""
        try:
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
        except Exception as e:
            _logger.error(f"Validate delivery error: {str(e)}")
            return {'success': False, 'error': str(e)}

    # ==================== INTERNAL TRANSFER OPERATIONS ====================

    @http.route('/api/mobile/transfers/list', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def list_internal_transfers(self, **kwargs):
        """
        List all pending internal transfers
        Optional filters: state, date_from, date_to
        """
        try:
            domain = [('picking_type_code', '=', 'internal')]
            
            state = kwargs.get('state', 'assigned')
            if state:
                domain.append(('state', '=', state))
            
            date_from = kwargs.get('date_from')
            if date_from:
                domain.append(('scheduled_date', '>=', date_from))
            
            date_to = kwargs.get('date_to')
            if date_to:
                domain.append(('scheduled_date', '<=', date_to))

            pickings = request.env['stock.picking'].search(domain, order='scheduled_date desc')
            
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
        except Exception as e:
            _logger.error(f"List transfers error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/transfers/<int:picking_id>', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def get_transfer_detail(self, picking_id, **kwargs):
        """Get detailed information about a specific internal transfer"""
        try:
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

            data = {
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

            return {'success': True, 'data': data}
        except Exception as e:
            _logger.error(f"Get transfer detail error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/transfers/<int:picking_id>/update', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def update_transfer_line(self, picking_id, **kwargs):
        """
        Update quantity done for a transfer line
        Expected params: move_id, quantity_done
        """
        try:
            move_id = kwargs.get('move_id')
            quantity_done = kwargs.get('quantity_done')

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
        except Exception as e:
            _logger.error(f"Update transfer line error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/transfers/<int:picking_id>/validate', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_transfer(self, picking_id, **kwargs):
        """Validate/Complete an internal transfer operation"""
        try:
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
        except Exception as e:
            _logger.error(f"Validate transfer error: {str(e)}")
            return {'success': False, 'error': str(e)}

    # ==================== PRODUCT SEARCH & BARCODE ====================

    @http.route('/api/mobile/products/search', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def search_products(self, **kwargs):
        """
        Search products by name, code, or barcode
        Expected params: query (search term), limit (optional)
        """
        try:
            query = kwargs.get('query', '')
            limit = kwargs.get('limit', 20)

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
        except Exception as e:
            _logger.error(f"Search products error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/products/<int:product_id>/stock', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def get_product_stock(self, product_id, **kwargs):
        """
        Get stock levels for a product across locations
        Optional params: location_id (filter by specific location)
        """
        try:
            product = request.env['product.product'].browse(product_id)
            if not product.exists():
                return {'success': False, 'error': 'Product not found'}

            location_id = kwargs.get('location_id')
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
        except Exception as e:
            _logger.error(f"Get product stock error: {str(e)}")
            return {'success': False, 'error': str(e)}

    # ==================== LOCATIONS ====================

    @http.route('/api/mobile/locations/list', type='json', auth='user', methods=['POST', 'OPTIONS'], csrf=False)
    def list_locations(self, **kwargs):
        """
        List available locations
        Optional params: usage (filter by usage type: internal, supplier, customer, etc.)
        """
        try:
            domain = []
            
            usage = kwargs.get('usage')
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
        except Exception as e:
            _logger.error(f"List locations error: {str(e)}")
            return {'success': False, 'error': str(e)}

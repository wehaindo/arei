# -*- coding: utf-8 -*-

from odoo import models, api, fields, _
from odoo.exceptions import UserError, ValidationError


class StockPicking(models.Model):
    _inherit = 'stock.picking'

    pos_session_id = fields.Many2one(
        'pos.session',
        string='POS Session',
        help='POS session that created this receiving'
    )
    
    created_from_pos = fields.Boolean(
        string='Created from POS',
        default=False,
        help='Indicates this picking was created from POS'
    )

    @api.model
    def create_pos_receiving(self, vals):
        """
        Create a receiving order from POS
        Args:
            vals: dict with keys:
                - pos_session_id: int
                - lines: list of dicts with product_id, qty, lot_name (optional)
        Returns:
            dict with picking data
        """
        session = self.env['pos.session'].browse(vals.get('pos_session_id'))
        if not session.exists():
            raise UserError(_('Invalid POS session'))
        
        # Check if user has access (POS administrator)
        if not session.user_id.has_group('point_of_sale.group_pos_manager'):
            raise UserError(_('Only POS administrators can create receiving orders'))
        
        config = session.config_id
        
        # Get receiving location from config or use stock location from picking type
        picking_type = config.picking_type_id
        if not picking_type:
            raise UserError(_('No picking type configured for this POS'))
        
        location_dest_id = config.receiving_location_id.id if config.receiving_location_id else picking_type.default_location_dest_id.id
        
        if not location_dest_id:
            raise UserError(_('No receiving location configured'))
        
        # Get supplier location (virtual)
        supplier_location = self.env.ref('stock.stock_location_suppliers')
        
        # Create picking
        picking_vals = {
            'picking_type_id': picking_type.id,
            'location_id': supplier_location.id,
            'location_dest_id': location_dest_id,
            'pos_session_id': session.id,
            'created_from_pos': True,
            'origin': f'POS/{session.name}',
            'move_ids_without_package': [],
        }
        
        # Create move lines
        lines = vals.get('lines', [])
        if not lines:
            raise UserError(_('No products to receive'))
        
        for line in lines:
            product_id = line.get('product_id')
            qty = line.get('qty', 1)
            lot_name = line.get('lot_name')
            
            if not product_id or qty <= 0:
                continue
            
            product = self.env['product.product'].browse(product_id)
            if not product.exists():
                continue
            
            move_vals = {
                'name': product.name,
                'product_id': product.id,
                'product_uom_qty': qty,
                'product_uom': product.uom_id.id,
                'location_id': supplier_location.id,
                'location_dest_id': location_dest_id,
            }
            
            # If lot/serial number provided, add it to move line
            if lot_name and product.tracking != 'none':
                move_vals['move_line_ids'] = [(0, 0, {
                    'product_id': product.id,
                    'product_uom_id': product.uom_id.id,
                    'location_id': supplier_location.id,
                    'location_dest_id': location_dest_id,
                    'lot_name': lot_name,
                    'qty_done': qty,
                })]
            
            picking_vals['move_ids_without_package'].append((0, 0, move_vals))
        
        # Create the picking
        picking = self.create(picking_vals)
        
        return {
            'id': picking.id,
            'name': picking.name,
            'state': picking.state,
            'location_dest_id': [picking.location_dest_id.id, picking.location_dest_id.name],
        }
    
    @api.model
    def validate_pos_receiving(self, picking_id):
        """
        Validate a receiving order from POS
        Args:
            picking_id: int
        Returns:
            dict with success status
        """
        picking = self.browse(picking_id)
        
        if not picking.exists():
            raise UserError(_('Receiving order not found'))
        
        if not picking.created_from_pos:
            raise UserError(_('This is not a POS receiving order'))
        
        # Check if user has access
        if not self.env.user.has_group('point_of_sale.group_pos_manager'):
            raise UserError(_('Only POS administrators can validate receiving orders'))
        
        if picking.state == 'done':
            raise UserError(_('Receiving order is already validated'))
        
        # Set quantities done for moves without move lines
        for move in picking.move_ids_without_package:
            if not move.move_line_ids:
                move.quantity_done = move.product_uom_qty
        
        # Validate the picking
        try:
            picking.button_validate()
            return {
                'success': True,
                'message': _('Receiving order validated successfully'),
                'picking_name': picking.name,
                'state': picking.state,
            }
        except Exception as e:
            raise UserError(_(f'Error validating receiving: {str(e)}'))

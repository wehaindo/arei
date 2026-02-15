# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError


class MrpProduceWizardComponent(models.TransientModel):
    _name = 'mrp.produce.wizard.component'
    _description = 'Manufacturing Wizard Component Line'

    wizard_id = fields.Many2one('mrp.produce.wizard', string='Wizard', required=True, ondelete='cascade')
    move_id = fields.Many2one('stock.move', string='Stock Move')
    product_id = fields.Many2one('product.product', string='Product', required=True)
    product_tracking = fields.Selection(related='product_id.tracking', string='Tracking')
    product_uom_id = fields.Many2one('uom.uom', string='Unit of Measure', required=True)
    qty_to_consume = fields.Float('To Consume', required=True)
    qty_done = fields.Float('Consumed', required=True)
    
    # Lot/Serial for component
    lot_id = fields.Many2one('stock.lot', string='Lot/Serial Number')
    lot_name = fields.Char('Lot/Serial Number Name')
    
    @api.onchange('qty_done')
    def _onchange_qty_done(self):
        if self.product_tracking == 'serial' and self.qty_done > 1:
            self.qty_done = 1
            return {
                'warning': {
                    'title': _('Warning'),
                    'message': _('Serial tracked products can only have quantity 1.')
                }
            }


class MrpProduceWizard(models.TransientModel):
    _name = 'mrp.produce.wizard'
    _description = 'Manufacturing Order Production Wizard'

    production_id = fields.Many2one('mrp.production', string='Manufacturing Order', required=True)
    product_id = fields.Many2one('product.product', string='Product', related='production_id.product_id')
    product_tracking = fields.Selection(related='product_id.tracking', string='Product Tracking')
    qty_producing = fields.Float('Quantity Producing', required=True, default=1.0)
    product_uom_id = fields.Many2one('uom.uom', string='Unit of Measure', related='production_id.product_uom_id')
    
    # Finished product lot/serial
    lot_producing_id = fields.Many2one('stock.lot', string='Lot/Serial Number')
    lot_name = fields.Char('Lot/Serial Number Name')
    
    # Serial number input method
    serial_input_method = fields.Selection([
        ('single', 'Input One by One'),
        ('bulk', 'Provide All Serial Numbers'),
        ('auto', 'Auto Generate Serial Numbers')
    ], string='Serial Input Method', default='single')
    bulk_serial_numbers = fields.Text('Serial Numbers', help='Enter serial numbers, one per line')
    
    # Component lines
    component_line_ids = fields.One2many('mrp.produce.wizard.component', 'wizard_id', string='Components')
    
    # State tracking
    state = fields.Selection([
        ('input_quantity', 'Input Quantity'),
        ('input_lot', 'Input Lot/Serial'),
        ('input_components', 'Input Components'),
        ('confirm', 'Confirm'),
    ], default='input_quantity', string='State')

    @api.model
    def default_get(self, fields_list):
        res = super(MrpProduceWizard, self).default_get(fields_list)
        if 'production_id' in res and res['production_id']:
            production = self.env['mrp.production'].browse(res['production_id'])
            # Auto-create component lines
            component_lines = []
            for move in production.move_raw_ids.filtered(lambda m: m.state not in ['done', 'cancel']):
                qty_to_consume = move.product_uom_qty - move.quantity_done
                if qty_to_consume > 0:
                    component_lines.append((0, 0, {
                        'product_id': move.product_id.id,
                        'product_uom_id': move.product_uom.id,
                        'qty_to_consume': qty_to_consume,
                        'qty_done': 0,
                        'move_id': move.id,
                    }))
            res['component_line_ids'] = component_lines
        return res

    def action_next(self):
        """Move to next step"""
        self.ensure_one()
        if self.state == 'input_quantity':
            if self.product_tracking in ['lot', 'serial']:
                self.state = 'input_lot'
            else:
                self.state = 'input_components'
        elif self.state == 'input_lot':
            # For bulk method, validate all serial numbers
            if self.serial_input_method == 'bulk':
                self._validate_bulk_serials()
            else:
                self._validate_lot()
            self.state = 'input_components'
        elif self.state == 'input_components':
            self._validate_components()
            self.state = 'confirm'
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'mrp.produce.wizard',
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def action_back(self):
        """Go back to previous step"""
        self.ensure_one()
        if self.state == 'confirm':
            self.state = 'input_components'
        elif self.state == 'input_components':
            if self.product_tracking in ['lot', 'serial']:
                self.state = 'input_lot'
            else:
                self.state = 'input_quantity'
        elif self.state == 'input_lot':
            self.state = 'input_quantity'
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'mrp.produce.wizard',
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def _validate_bulk_serials(self):
        """Validate bulk serial number input"""
        if not self.bulk_serial_numbers:
            raise ValidationError(_('Please enter serial numbers.'))
        
        # Split by newlines and remove empty lines
        serial_numbers = [s.strip() for s in self.bulk_serial_numbers.split('\n') if s.strip()]
        
        if not serial_numbers:
            raise ValidationError(_('Please enter serial numbers.'))
        
        # Get count of pending move lines
        finished_move = self.production_id.move_finished_ids.filtered(
            lambda m: m.product_id == self.product_id and m.state not in ['done', 'cancel']
        )[:1]
        
        if finished_move:
            pending_lines = finished_move.move_line_ids.filtered(lambda ml: not ml.lot_id)
            required_count = len(pending_lines)
            
            if len(serial_numbers) > required_count:
                raise ValidationError(_('You entered %s serial numbers but only %s units remain.') % (len(serial_numbers), required_count))
        
        # Check for duplicates in input
        if len(serial_numbers) != len(set(serial_numbers)):
            raise ValidationError(_('Duplicate serial numbers found in your input.'))
        
        # Check if serial numbers already exist
        for serial in serial_numbers:
            existing = self.env['stock.lot'].search([
                ('name', '=', serial),
                ('product_id', '=', self.product_id.id),
            ], limit=1)
            if existing and existing.product_qty > 0:
                raise ValidationError(_('Serial number %s is already used.') % serial)
    
    def _validate_lot(self):
        """Validate lot/serial number input"""
        if self.product_tracking == 'serial' and self.qty_producing != 1:
            raise ValidationError(_('For serial tracked products, quantity must be 1.'))
        
        if self.product_tracking in ['lot', 'serial']:
            if self.lot_producing_id:
                # Existing lot
                if self.product_tracking == 'serial' and self.lot_producing_id.product_qty > 0:
                    raise ValidationError(_('Serial number %s is already used.') % self.lot_producing_id.name)
            elif self.lot_name:
                # Check if lot name already exists
                existing_lot = self.env['stock.lot'].search([
                    ('name', '=', self.lot_name),
                    ('product_id', '=', self.product_id.id),
                    ('company_id', '=', self.production_id.company_id.id)
                ], limit=1)
                
                if existing_lot:
                    if self.product_tracking == 'serial' and existing_lot.product_qty > 0:
                        raise ValidationError(_('Serial number %s is already used.') % self.lot_name)
                    self.lot_producing_id = existing_lot
            else:
                # Auto-generate if enabled
                if self.product_id.auto_create_lot:
                    self.lot_name = self.env['ir.sequence'].next_by_code('stock.lot.serial')
                else:
                    raise ValidationError(_('Please enter a lot/serial number.'))

    def _validate_components(self):
        """Validate component consumption"""
        for component in self.component_line_ids:
            if component.product_id.tracking in ['lot', 'serial'] and component.qty_done > 0:
                if not component.lot_id and not component.lot_name:
                    raise ValidationError(_('Please enter lot/serial for %s') % component.product_id.name)
                
                if component.product_id.tracking == 'serial' and component.qty_done != 1:
                    raise ValidationError(_('Serial tracked component %s must have quantity 1.') % component.product_id.name)

    def action_produce(self):
        """Process the production - update one lot/serial at a time or bulk"""
        self.ensure_one()
        
        # Validate based on method
        if self.serial_input_method == 'bulk':
            self._validate_bulk_serials()
        else:
            self._validate_lot()
        
        self._validate_components()
        
        production = self.production_id
        
        # Process finished product
        finished_move = production.move_finished_ids.filtered(
            lambda m: m.product_id == self.product_id and m.state not in ['done', 'cancel']
        )[:1]
        
        if finished_move:
            if self.serial_input_method == 'bulk':
                # Process all serial numbers at once
                serial_numbers = [s.strip() for s in self.bulk_serial_numbers.split('\n') if s.strip()]
                pending_lines = finished_move.move_line_ids.filtered(lambda ml: not ml.lot_id)
                
                for idx, serial in enumerate(serial_numbers):
                    if idx < len(pending_lines):
                        lot_id = self.env['stock.lot'].create({
                            'name': serial,
                            'product_id': self.product_id.id,
                            'company_id': production.company_id.id,
                        }).id
                        pending_lines[idx].write({'lot_id': lot_id})
            elif self.serial_input_method == 'auto':
                # Auto-generate serial number
                serial = self.env['ir.sequence'].next_by_code('stock.lot.serial')
                lot_id = self.env['stock.lot'].create({
                    'name': serial,
                    'product_id': self.product_id.id,
                    'company_id': production.company_id.id,
                }).id
                
                move_line = finished_move.move_line_ids.filtered(lambda ml: not ml.lot_id)[:1]
                if move_line:
                    move_line.write({'lot_id': lot_id})
            else:
                # Single serial input (one by one)
                lot_id = False
                if self.product_tracking in ['lot', 'serial']:
                    if self.lot_producing_id:
                        lot_id = self.lot_producing_id.id
                    elif self.lot_name:
                        lot_id = self.env['stock.lot'].create({
                            'name': self.lot_name,
                            'product_id': self.product_id.id,
                            'company_id': production.company_id.id,
                        }).id
                
                # Find first move line without lot/serial and update only that one
                move_line = finished_move.move_line_ids.filtered(lambda ml: not ml.lot_id)[:1]
                
                if move_line:
                    move_line.write({
                        'lot_id': lot_id,
                    })
        
        # Process component consumption - update only one move line per component
        for component in self.component_line_ids:
            if component.qty_done > 0:
                move = component.move_id
                
                # Get or create lot for component
                component_lot_id = False
                if component.product_id.tracking in ['lot', 'serial']:
                    if component.lot_id:
                        component_lot_id = component.lot_id.id
                    elif component.lot_name:
                        component_lot_id = self.env['stock.lot'].create({
                            'name': component.lot_name,
                            'product_id': component.product_id.id,
                            'company_id': production.company_id.id,
                        }).id
                
                # Find first move line without lot/serial and update only that one
                move_line = move.move_line_ids.filtered(lambda ml: not ml.lot_id)[:1]
                
                if move_line:
                    move_line.write({
                        'lot_id': component_lot_id,
                    })
        
        # Check if all move lines have lot/serial numbers assigned
        all_finished = True
        if finished_move:
            remaining_lines = finished_move.move_line_ids.filtered(lambda ml: not ml.lot_id)
            if remaining_lines:
                all_finished = False
        
        if all_finished:
            # All move lines have lot/serial - validate and finish the production
            try:
                # Set quantities on all move lines if needed
                for ml in finished_move.move_line_ids:
                    if not ml.quantity or ml.quantity == 0:
                        ml.quantity = 1
                
                # Mark production as done
                production.with_context(skip_backorder=True).button_mark_done()
                message = _('Production completed successfully!')
            except Exception as e:
                message = _('Lot/Serial number updated. Manual completion required: %s') % str(e)
        else:
            message = _('Lot/Serial number updated. Continue to process remaining units.')
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Success'),
                'message': message,
                'type': 'success',
                'sticky': False,
            }
        }

    def action_scan_lot(self):
        """Scan lot/serial using barcode"""
        # This can be extended to support barcode scanning
        pass

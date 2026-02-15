# -*- coding: utf-8 -*-

from odoo import models, fields, api


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    def action_open_produce_wizard(self):
        """Open the production wizard"""
        self.ensure_one()
        return {
            'name': 'Produce Products',
            'type': 'ir.actions.act_window',
            'res_model': 'mrp.produce.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_production_id': self.id,
                'default_qty_producing': self.product_qty - self.qty_produced,
            }
        }

    def action_confirm(self):
        """Override to ensure serial tracked products generate individual move lines"""
        res = super(MrpProduction, self).action_confirm()
        
        for production in self:
            # Check if finished product uses serial tracking
            if production.product_id.tracking == 'serial':
                # Find the finished product move
                finished_move = production.move_finished_ids.filtered(
                    lambda m: m.product_id == production.product_id
                )
                
                for move in finished_move:
                    # Delete existing move lines
                    move.move_line_ids.unlink()
                    
                    # Create individual move lines for each serial unit
                    qty = int(move.product_uom_qty)
                    for i in range(qty):
                        self.env['stock.move.line'].create({
                            'move_id': move.id,
                            'product_id': move.product_id.id,
                            'product_uom_id': move.product_uom.id,
                            'quantity': 1,
                            'location_id': move.location_id.id,
                            'location_dest_id': move.location_dest_id.id,
                        })
        
        return res

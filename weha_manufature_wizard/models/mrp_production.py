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

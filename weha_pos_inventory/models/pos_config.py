# -*- coding: utf-8 -*-

from odoo import models, fields


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_inventory_receiving = fields.Boolean(
        string='Enable Inventory Receiving',
        default=False,
        help='Allow POS administrators to create receiving orders from POS'
    )
    
    receiving_location_id = fields.Many2one(
        'stock.location',
        string='Receiving Location',
        domain=[('usage', '=', 'internal')],
        help='Default destination location for receiving inventory from POS'
    )

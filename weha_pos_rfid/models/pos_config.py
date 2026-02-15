# -*- coding: utf-8 -*-
from odoo import models, fields


class PosConfig(models.Model):
    _inherit = 'pos.config'

    rfid_enabled = fields.Boolean(
        string='Enable RFID Reader',
        default=False,
        help='Enable RFID tag scanning to add products to POS orders'
    )
    rfid_websocket_url = fields.Char(
        string='RFID WebSocket URL',
        default='ws://localhost:8081',
        help='WebSocket URL of the RFID reader application'
    )
    rfid_auto_add = fields.Boolean(
        string='Auto Add Products',
        default=True,
        help='Automatically add products to order when RFID tag is scanned'
    )

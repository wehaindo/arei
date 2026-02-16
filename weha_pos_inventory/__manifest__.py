# -*- coding: utf-8 -*-
{
    'name': 'POS Inventory Receiving',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Handle inventory receiving from POS',
    'description': """
        POS Inventory Receiving
        =======================
        - Create receiving orders from POS based on store location
        - Validate receiving on server
        - Button only visible for POS administrators
    """,
    'author': 'Your Company',
    'depends': ['point_of_sale', 'stock'],
    'data': [
        'security/ir.model.access.csv',
        'views/pos_config_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'weha_pos_inventory/static/src/**/*',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}

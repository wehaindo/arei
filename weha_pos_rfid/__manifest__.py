# -*- coding: utf-8 -*-
{
    'name': 'POS RFID Integration',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Add products to POS using RFID reader',
    'description': """
        POS RFID Integration
        ====================
        - Connect to desktop RFID reader via WebSocket
        - Automatically add products to POS order when RFID tag is scanned
        - Find products by lot/serial number from RFID tag EPC
    """,
    'author': 'Your Company',
    'depends': ['point_of_sale', 'stock'],
    'data': [
        'views/pos_config_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'weha_pos_rfid/static/src/css/rfid_indicator.css',
            'weha_pos_rfid/static/src/xml/rfid_button.xml',
            'weha_pos_rfid/static/src/xml/rfid_indicator.xml',
            'weha_pos_rfid/static/src/js/rfid_service.js',
            'weha_pos_rfid/static/src/js/rfid_button.js',
            ('lazy', 'weha_pos_rfid/static/src/js/rfid_indicator.js'),
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}

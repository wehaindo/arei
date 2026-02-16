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
            # Assets must be loaded in dependency order
            # Service first (creates the rfid service)
            'weha_pos_rfid/static/src/js/rfid_service.js',
            # Button component
            'weha_pos_rfid/static/src/js/rfid_button.js',
            # Navbar patch (depends on Navbar being loaded by point_of_sale)
            'weha_pos_rfid/static/src/js/rfid_indicator.js',
            # Templates
            'weha_pos_rfid/static/src/xml/rfid_button.xml',
            'weha_pos_rfid/static/src/xml/rfid_indicator.xml',
            # Styles
            'weha_pos_rfid/static/src/css/rfid_indicator.css',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}

# -*- coding: utf-8 -*-
{
    'name': 'Manufacturing Order Wizard',
    'version': '18.0.1.0.0',
    'category': 'Manufacturing',
    'summary': 'Process manufacturing orders with lot/serial tracking',
    'description': """
        Manufacturing Order Processing Wizard
        ======================================
        * Process manufacturing orders one by one
        * Input lot/serial numbers for each product
        * Track component consumption
        * Support RFID tag scanning
    """,
    'author': 'Weha',
    'depends': ['mrp', 'stock'],
    'data': [
        'security/ir.model.access.csv',
        'views/mrp_production_views.xml',
        'wizard/mrp_produce_wizard_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}

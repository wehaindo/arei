# -*- coding: utf-8 -*-
{
    'name': 'Weha Inventory Controller',
    'version': '18.0.1.0.0',
    'category': 'Inventory',
    'summary': 'Mobile App Controller for Inventory Operations',
    'description': """
        HTTP Controller for Mobile Applications
        ========================================
        This module provides REST API endpoints for mobile applications to handle:
        - Receipt operations (incoming shipments)
        - Delivery operations (outgoing shipments)
        - Internal transfers
        
        Features:
        - List pending operations
        - Scan products and validate operations
        - Update quantities and locations
        - Validate/Complete operations
    """,
    'author': 'Weha',
    'website': 'https://www.weha.com',
    'depends': ['base', 'stock', 'product'],
    'data': [
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}

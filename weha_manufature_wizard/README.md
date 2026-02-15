# Manufacturing Order Wizard

## Overview
This module provides a step-by-step wizard for processing manufacturing orders with lot/serial tracking.

## Features
- Process manufacturing orders one by one
- Input quantity for finished product
- Input lot/serial numbers for finished products
- Input lot/serial numbers for consumed components
- Support for both lot and serial number tracking
- Validation for serial numbers (quantity must be 1)
- Component consumption tracking

## Usage

1. Open a Manufacturing Order in state "Confirmed" or "In Progress"
2. Click the "Produce Step by Step" button
3. Follow the wizard steps:
   - **Step 1**: Enter quantity to produce
   - **Step 2**: Enter lot/serial number for finished product (if tracked)
   - **Step 3**: Enter lot/serial numbers for components (if tracked)
   - **Step 4**: Review and confirm
4. Click "Produce" to record the production

## Installation

1. Copy the `weha_manufature_wizard` folder to your Odoo addons directory
2. Update the apps list (Apps → Update Apps List)
3. Install the module (Apps → Search "Manufacturing Order Wizard" → Install)

## Dependencies
- mrp (Manufacturing)
- stock (Inventory)

## Technical Details

### Models
- `mrp.produce.wizard`: Main wizard model for production processing
- `mrp.produce.wizard.component`: Component lines for the wizard
- `mrp.production`: Inherited to add wizard button

### Views
- Wizard form view with multi-step process
- Inherited manufacturing order form view with wizard button

### Security
- Access rights for Manufacturing User group

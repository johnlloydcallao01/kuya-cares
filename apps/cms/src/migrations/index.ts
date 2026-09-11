import * as migration_20250103_category_filtering_indexes from './20250103_category_filtering_indexes';
import * as migration_20251017_040757 from './20251017_040757';
import * as migration_20251017_042000 from './20251017_042000';
import * as migration_20251017_052855_product_management_tables from './20251017_052855_product_management_tables';
import * as migration_20251101_112210_merchant_products_added_by_optional from './20251101_112210_merchant_products_added_by_optional';
import * as migration_20251102_095049_replace_auto_assign_field from './20251102_095049_replace_auto_assign_field';
import * as migration_20251102_161143 from './20251102_161143';
import * as migration_20251108_065341 from './20251108_065341';
import * as migration_20251115_061448 from './20251115_061448';
import * as migration_20251115_130118 from './20251115_130118';
import * as migration_20251115_132619 from './20251115_132619';
import * as migration_20251118_120501_make_base_price_optional_for_grouped from './20251118_120501_make_base_price_optional_for_grouped';
import * as migration_20251119_141500_fix_product_fk_delete_behavior from './20251119_141500_fix_product_fk_delete_behavior';
import * as migration_20251119_200000_fix_product_delete_behavior_cascade from './20251119_200000_fix_product_delete_behavior_cascade';
import * as migration_20251120_120000_add_variation_id_to_variation_values from './20251120_120000_add_variation_id_to_variation_values';
import * as migration_20251120_171500_add_product_attribute_combo_to_prod_variations from './20251120_171500_add_product_attribute_combo_to_prod_variations';
import * as migration_20251120_173100_remove_variation_product_from_variation_values from './20251120_173100_remove_variation_product_from_variation_values';
import * as migration_20251120_174200_drop_attribute_id_from_variation_values from './20251120_174200_drop_attribute_id_from_variation_values';
import * as migration_20251121_180000_update_variations_and_merchant_products from './20251121_180000_update_variations_and_merchant_products';
import * as migration_20251121_193000_backfill_attribute_id_on_prod_variation_values from './20251121_193000_backfill_attribute_id_on_prod_variation_values';
import * as migration_20251121_204000_add_slug_to_products from './20251121_204000_add_slug_to_products';
import * as migration_20251121_214500_add_variation_name from './20251121_214500_add_variation_name';
import * as migration_20251121_220000_backfill_variation_sku from './20251121_220000_backfill_variation_sku';
import * as migration_20251121_222000_add_variation_image from './20251121_222000_add_variation_image';
import * as migration_20251121_230000_update_variation_sku_format from './20251121_230000_update_variation_sku_format';
import * as migration_20251121_231500_backfill_products_sku from './20251121_231500_backfill_products_sku';
import * as migration_20251121_233000_products_sku_trigger from './20251121_233000_products_sku_trigger';
import * as migration_20251121_235000_uppercase_products_sku from './20251121_235000_uppercase_products_sku';
import * as migration_20251122_090515_add_short_description_to_prod_variations from './20251122_090515_add_short_description_to_prod_variations';
import * as migration_20251123_023957_add_merchant_categories from './20251123_023957_add_merchant_categories';
import * as migration_20251124_021145 from './20251124_021145';
import * as migration_20251124_021940 from './20251124_021940';
import * as migration_20251124_120500_add_driver_role_and_drivers_table from './20251124_120500_add_driver_role_and_drivers_table';
import * as migration_20251126_070002 from './20251126_070002';
import * as migration_20251127_022816 from './20251127_022816';
import * as migration_20251202_remove_vendor_products_table from './20251202_remove_vendor_products_table';
import * as migration_20260116_084737 from './20260116_084737';
import * as migration_20260118_131627 from './20260118_131627';
import * as migration_20260118_132800_drop_wishlist_items from './20260118_132800_drop_wishlist_items';
import * as migration_20260118_142441 from './20260118_142441';
import * as migration_20260119_130104 from './20260119_130104';
import * as migration_20260120_152616_ordering_system from './20260120_152616_ordering_system';
import * as migration_20260120_155018_rename_rider_to_driver from './20260120_155018_rename_rider_to_driver';
import * as migration_20260122_000000_add_email_to_customers from './20260122_000000_add_email_to_customers';
import * as migration_20260122_010000_add_display_title_to_merchant_products from './20260122_010000_add_display_title_to_merchant_products';
import * as migration_20260123_050112_add_timezone_to_merchants from './20260123_050112_add_timezone_to_merchants';
import * as migration_20260125_093000_fix_handle_role_change_function from './20260125_093000_fix_handle_role_change_function';
import * as migration_20260125_160000_enforce_after_role_triggers from './20260125_160000_enforce_after_role_triggers';
import * as migration_20260125_170000_disable_user_events_logging from './20260125_170000_disable_user_events_logging';
import * as migration_20260125_180000_remove_create_role_record from './20260125_180000_remove_create_role_record';
import * as migration_20260128_000100_fix_users_role_triggers_cleanup from './20260128_000100_fix_users_role_triggers_cleanup';
import * as migration_20260301_134303_add_system_settings_maintenance_mode from './20260301_134303_add_system_settings_maintenance_mode';
import * as migration_20260309_fix_product_delete_constraints from './20260309_fix_product_delete_constraints';
import * as migration_20260309_fix_product_delete_constraints_part2 from './20260309_fix_product_delete_constraints_part2';
import * as migration_20260309_fix_product_delete_constraints_part3 from './20260309_fix_product_delete_constraints_part3';
import * as migration_20260329_062428 from './20260329_062428';
import * as migration_20260521_120000_variation_modifier_models from './20260521_120000_variation_modifier_models';
import * as migration_20260521_160000_variation_modifier_behavior_mode from './20260521_160000_variation_modifier_behavior_mode';
import * as migration_20260521_200000_merchant_modifier_overrides from './20260521_200000_merchant_modifier_overrides';
import * as migration_20260805_173628 from './20260805_173628';
import * as migration_20260809_162303 from './20260809_162303';
import * as migration_20260809_163543 from './20260809_163543';
import * as migration_20260809_164531 from './20260809_164531';
import * as migration_20260809_171401 from './20260809_171401';
import * as migration_20260809_172255 from './20260809_172255';
import * as migration_20260809_235411 from './20260809_235411';
import * as migration_20260809_add_user_notifications_seen_at from './20260809_add_user_notifications_seen_at';
import * as migration_20260824_120000_add_modifier_override_uniqueness from './20260824_120000_add_modifier_override_uniqueness';
import * as migration_20260831_081031 from './20260831_081031';
import * as migration_20260903_000000_normalize_store_hours from './20260903_000000_normalize_store_hours';
import * as migration_20260903_115731 from './20260903_115731';

export const migrations = [
  {
    up: migration_20250103_category_filtering_indexes.up,
    down: migration_20250103_category_filtering_indexes.down,
    name: '20250103_category_filtering_indexes',
  },
  {
    up: migration_20251017_040757.up,
    down: migration_20251017_040757.down,
    name: '20251017_040757',
  },
  {
    up: migration_20251017_042000.up,
    down: migration_20251017_042000.down,
    name: '20251017_042000',
  },
  {
    up: migration_20251017_052855_product_management_tables.up,
    down: migration_20251017_052855_product_management_tables.down,
    name: '20251017_052855_product_management_tables',
  },
  {
    up: migration_20251101_112210_merchant_products_added_by_optional.up,
    down: migration_20251101_112210_merchant_products_added_by_optional.down,
    name: '20251101_112210_merchant_products_added_by_optional',
  },
  {
    up: migration_20251102_095049_replace_auto_assign_field.up,
    down: migration_20251102_095049_replace_auto_assign_field.down,
    name: '20251102_095049_replace_auto_assign_field',
  },
  {
    up: migration_20251102_161143.up,
    down: migration_20251102_161143.down,
    name: '20251102_161143',
  },
  {
    up: migration_20251108_065341.up,
    down: migration_20251108_065341.down,
    name: '20251108_065341',
  },
  {
    up: migration_20251115_061448.up,
    down: migration_20251115_061448.down,
    name: '20251115_061448',
  },
  {
    up: migration_20251115_130118.up,
    down: migration_20251115_130118.down,
    name: '20251115_130118',
  },
  {
    up: migration_20251115_132619.up,
    down: migration_20251115_132619.down,
    name: '20251115_132619',
  },
  {
    up: migration_20251118_120501_make_base_price_optional_for_grouped.up,
    down: migration_20251118_120501_make_base_price_optional_for_grouped.down,
    name: '20251118_120501_make_base_price_optional_for_grouped',
  },
  {
    up: migration_20251119_141500_fix_product_fk_delete_behavior.up,
    down: migration_20251119_141500_fix_product_fk_delete_behavior.down,
    name: '20251119_141500_fix_product_fk_delete_behavior',
  },
  {
    up: migration_20251119_200000_fix_product_delete_behavior_cascade.up,
    down: migration_20251119_200000_fix_product_delete_behavior_cascade.down,
    name: '20251119_200000_fix_product_delete_behavior_cascade',
  },
  {
    up: migration_20251120_120000_add_variation_id_to_variation_values.up,
    down: migration_20251120_120000_add_variation_id_to_variation_values.down,
    name: '20251120_120000_add_variation_id_to_variation_values',
  },
  {
    up: migration_20251120_171500_add_product_attribute_combo_to_prod_variations.up,
    down: migration_20251120_171500_add_product_attribute_combo_to_prod_variations.down,
    name: '20251120_171500_add_product_attribute_combo_to_prod_variations',
  },
  {
    up: migration_20251120_173100_remove_variation_product_from_variation_values.up,
    down: migration_20251120_173100_remove_variation_product_from_variation_values.down,
    name: '20251120_173100_remove_variation_product_from_variation_values',
  },
  {
    up: migration_20251120_174200_drop_attribute_id_from_variation_values.up,
    down: migration_20251120_174200_drop_attribute_id_from_variation_values.down,
    name: '20251120_174200_drop_attribute_id_from_variation_values',
  },
  {
    up: migration_20251121_180000_update_variations_and_merchant_products.up,
    down: migration_20251121_180000_update_variations_and_merchant_products.down,
    name: '20251121_180000_update_variations_and_merchant_products',
  },
  {
    up: migration_20251121_193000_backfill_attribute_id_on_prod_variation_values.up,
    down: migration_20251121_193000_backfill_attribute_id_on_prod_variation_values.down,
    name: '20251121_193000_backfill_attribute_id_on_prod_variation_values',
  },
  {
    up: migration_20251121_204000_add_slug_to_products.up,
    down: migration_20251121_204000_add_slug_to_products.down,
    name: '20251121_204000_add_slug_to_products',
  },
  {
    up: migration_20251121_214500_add_variation_name.up,
    down: migration_20251121_214500_add_variation_name.down,
    name: '20251121_214500_add_variation_name',
  },
  {
    up: migration_20251121_220000_backfill_variation_sku.up,
    down: migration_20251121_220000_backfill_variation_sku.down,
    name: '20251121_220000_backfill_variation_sku',
  },
  {
    up: migration_20251121_222000_add_variation_image.up,
    down: migration_20251121_222000_add_variation_image.down,
    name: '20251121_222000_add_variation_image',
  },
  {
    up: migration_20251121_230000_update_variation_sku_format.up,
    down: migration_20251121_230000_update_variation_sku_format.down,
    name: '20251121_230000_update_variation_sku_format',
  },
  {
    up: migration_20251121_231500_backfill_products_sku.up,
    down: migration_20251121_231500_backfill_products_sku.down,
    name: '20251121_231500_backfill_products_sku',
  },
  {
    up: migration_20251121_233000_products_sku_trigger.up,
    down: migration_20251121_233000_products_sku_trigger.down,
    name: '20251121_233000_products_sku_trigger',
  },
  {
    up: migration_20251121_235000_uppercase_products_sku.up,
    down: migration_20251121_235000_uppercase_products_sku.down,
    name: '20251121_235000_uppercase_products_sku',
  },
  {
    up: migration_20251122_090515_add_short_description_to_prod_variations.up,
    down: migration_20251122_090515_add_short_description_to_prod_variations.down,
    name: '20251122_090515_add_short_description_to_prod_variations',
  },
  {
    up: migration_20251123_023957_add_merchant_categories.up,
    down: migration_20251123_023957_add_merchant_categories.down,
    name: '20251123_023957_add_merchant_categories',
  },
  {
    up: migration_20251124_021145.up,
    down: migration_20251124_021145.down,
    name: '20251124_021145',
  },
  {
    up: migration_20251124_021940.up,
    down: migration_20251124_021940.down,
    name: '20251124_021940',
  },
  {
    up: migration_20251124_120500_add_driver_role_and_drivers_table.up,
    down: migration_20251124_120500_add_driver_role_and_drivers_table.down,
    name: '20251124_120500_add_driver_role_and_drivers_table',
  },
  {
    up: migration_20251126_070002.up,
    down: migration_20251126_070002.down,
    name: '20251126_070002',
  },
  {
    up: migration_20251127_022816.up,
    down: migration_20251127_022816.down,
    name: '20251127_022816',
  },
  {
    up: migration_20251202_remove_vendor_products_table.up,
    down: migration_20251202_remove_vendor_products_table.down,
    name: '20251202_remove_vendor_products_table',
  },
  {
    up: migration_20260116_084737.up,
    down: migration_20260116_084737.down,
    name: '20260116_084737',
  },
  {
    up: migration_20260118_131627.up,
    down: migration_20260118_131627.down,
    name: '20260118_131627',
  },
  {
    up: migration_20260118_132800_drop_wishlist_items.up,
    down: migration_20260118_132800_drop_wishlist_items.down,
    name: '20260118_132800_drop_wishlist_items',
  },
  {
    up: migration_20260118_142441.up,
    down: migration_20260118_142441.down,
    name: '20260118_142441',
  },
  {
    up: migration_20260119_130104.up,
    down: migration_20260119_130104.down,
    name: '20260119_130104',
  },
  {
    up: migration_20260120_152616_ordering_system.up,
    down: migration_20260120_152616_ordering_system.down,
    name: '20260120_152616_ordering_system',
  },
  {
    up: migration_20260120_155018_rename_rider_to_driver.up,
    down: migration_20260120_155018_rename_rider_to_driver.down,
    name: '20260120_155018_rename_rider_to_driver',
  },
  {
    up: migration_20260122_000000_add_email_to_customers.up,
    down: migration_20260122_000000_add_email_to_customers.down,
    name: '20260122_000000_add_email_to_customers',
  },
  {
    up: migration_20260122_010000_add_display_title_to_merchant_products.up,
    down: migration_20260122_010000_add_display_title_to_merchant_products.down,
    name: '20260122_010000_add_display_title_to_merchant_products',
  },
  {
    up: migration_20260123_050112_add_timezone_to_merchants.up,
    down: migration_20260123_050112_add_timezone_to_merchants.down,
    name: '20260123_050112_add_timezone_to_merchants',
  },
  {
    up: migration_20260125_093000_fix_handle_role_change_function.up,
    down: migration_20260125_093000_fix_handle_role_change_function.down,
    name: '20260125_093000_fix_handle_role_change_function',
  },
  {
    up: migration_20260125_160000_enforce_after_role_triggers.up,
    down: migration_20260125_160000_enforce_after_role_triggers.down,
    name: '20260125_160000_enforce_after_role_triggers',
  },
  {
    up: migration_20260125_170000_disable_user_events_logging.up,
    down: migration_20260125_170000_disable_user_events_logging.down,
    name: '20260125_170000_disable_user_events_logging',
  },
  {
    up: migration_20260125_180000_remove_create_role_record.up,
    down: migration_20260125_180000_remove_create_role_record.down,
    name: '20260125_180000_remove_create_role_record',
  },
  {
    up: migration_20260128_000100_fix_users_role_triggers_cleanup.up,
    down: migration_20260128_000100_fix_users_role_triggers_cleanup.down,
    name: '20260128_000100_fix_users_role_triggers_cleanup',
  },
  {
    up: migration_20260301_134303_add_system_settings_maintenance_mode.up,
    down: migration_20260301_134303_add_system_settings_maintenance_mode.down,
    name: '20260301_134303_add_system_settings_maintenance_mode',
  },
  {
    up: migration_20260309_fix_product_delete_constraints.up,
    down: migration_20260309_fix_product_delete_constraints.down,
    name: '20260309_fix_product_delete_constraints',
  },
  {
    up: migration_20260309_fix_product_delete_constraints_part2.up,
    down: migration_20260309_fix_product_delete_constraints_part2.down,
    name: '20260309_fix_product_delete_constraints_part2',
  },
  {
    up: migration_20260309_fix_product_delete_constraints_part3.up,
    down: migration_20260309_fix_product_delete_constraints_part3.down,
    name: '20260309_fix_product_delete_constraints_part3',
  },
  {
    up: migration_20260329_062428.up,
    down: migration_20260329_062428.down,
    name: '20260329_062428',
  },
  {
    up: migration_20260521_120000_variation_modifier_models.up,
    down: migration_20260521_120000_variation_modifier_models.down,
    name: '20260521_120000_variation_modifier_models',
  },
  {
    up: migration_20260521_160000_variation_modifier_behavior_mode.up,
    down: migration_20260521_160000_variation_modifier_behavior_mode.down,
    name: '20260521_160000_variation_modifier_behavior_mode',
  },
  {
    up: migration_20260521_200000_merchant_modifier_overrides.up,
    down: migration_20260521_200000_merchant_modifier_overrides.down,
    name: '20260521_200000_merchant_modifier_overrides',
  },
  {
    up: migration_20260805_173628.up,
    down: migration_20260805_173628.down,
    name: '20260805_173628',
  },
  {
    up: migration_20260809_162303.up,
    down: migration_20260809_162303.down,
    name: '20260809_162303',
  },
  {
    up: migration_20260809_163543.up,
    down: migration_20260809_163543.down,
    name: '20260809_163543',
  },
  {
    up: migration_20260809_164531.up,
    down: migration_20260809_164531.down,
    name: '20260809_164531',
  },
  {
    up: migration_20260809_171401.up,
    down: migration_20260809_171401.down,
    name: '20260809_171401',
  },
  {
    up: migration_20260809_172255.up,
    down: migration_20260809_172255.down,
    name: '20260809_172255',
  },
  {
    up: migration_20260809_235411.up,
    down: migration_20260809_235411.down,
    name: '20260809_235411',
  },
  {
    up: migration_20260809_add_user_notifications_seen_at.up,
    down: migration_20260809_add_user_notifications_seen_at.down,
    name: '20260809_add_user_notifications_seen_at',
  },
  {
    up: migration_20260824_120000_add_modifier_override_uniqueness.up,
    down: migration_20260824_120000_add_modifier_override_uniqueness.down,
    name: '20260824_120000_add_modifier_override_uniqueness',
  },
  {
    up: migration_20260831_081031.up,
    down: migration_20260831_081031.down,
    name: '20260831_081031',
  },
  {
    up: migration_20260903_000000_normalize_store_hours.up,
    down: migration_20260903_000000_normalize_store_hours.down,
    name: '20260903_000000_normalize_store_hours',
  },
  {
    up: migration_20260903_115731.up,
    down: migration_20260903_115731.down,
    name: '20260903_115731'
  },
];

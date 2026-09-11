import 'server-only';
import type { Product, ModifierGroup, ModifierOption } from '@/types/product';

export class ProductService {
  private static readonly API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

  static async getProductWithModifiers(productId: string): Promise<Product | null> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;

      // 1. Fetch Product
      const productRes = await fetch(`${this.API_BASE}/products/${productId}?depth=2`, {
        headers,
        next: { revalidate: 120 }
      });

      if (!productRes.ok) return null;
      const product: Product = await productRes.json();

      // 2. Fetch Modifier Groups
      // Query: where[product_id][equals]=productId
      const groupsRes = await fetch(`${this.API_BASE}/modifier-groups?where[product_id][equals]=${productId}&limit=100&sort=sort_order`, {
        headers,
        next: { revalidate: 120 }
      });

      let modifierGroups: ModifierGroup[] = [];
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        modifierGroups = groupsData.docs || [];
      }

      if (modifierGroups.length > 0) {
        // 3. Fetch Modifier Options
        // Query: where[modifier_group_id][in]=group1,group2,...
        const groupIds = modifierGroups.map(g => g.id).join(',');
        
        // Handle fetching options for multiple groups
        // Since the list might be long, we should be careful, but usually modifier groups per product are few.
        const optionsRes = await fetch(`${this.API_BASE}/modifier-options?where[modifier_group_id][in]=${groupIds}&limit=500&sort=sort_order`, {
            headers,
            next: { revalidate: 120 }
        });

        let allOptions: ModifierOption[] = [];
        if (optionsRes.ok) {
            const optionsData = await optionsRes.json();
            allOptions = optionsData.docs || [];
        }

        // 4. Associate Options with Groups
        modifierGroups = modifierGroups.map(group => ({
            ...group,
            options: allOptions.filter(opt => {
                const groupId = typeof opt.modifier_group_id === 'object' && opt.modifier_group_id !== null
                  ? (opt.modifier_group_id as any).id 
                  : opt.modifier_group_id;
                return groupId === group.id;
            })
        }));
      }

      return {
        ...product,
        modifierGroups
      };

    } catch (error) {
      console.error('Error fetching product with modifiers:', error);
      return null;
    }
  }
}

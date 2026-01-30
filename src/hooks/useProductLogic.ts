
import { useState, useCallback } from 'react';
import { Product, Ingredient, DataSourceMode } from '../types';

interface UseProductLogicProps {
    dataSource: DataSourceMode;
    apiCall: (endpoint: string, method: string, body?: any) => Promise<any>;
    showNotify: (msg: string, type?: 'success' | 'error') => void;
    t: (key: string) => string;
}

export const useProductLogic = ({ dataSource, apiCall, showNotify, t }: UseProductLogicProps) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    // --- PRODUCTS ---

    const addProduct = useCallback(async (p: Product): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/products', 'POST', p);
            if (res && res.success) { 
                setProducts(prev => [...prev, p]); 
                showNotify(t('notification.db_saved')); 
                return true; 
            }
            return false;
        } else {
            setProducts(prev => [...prev, p]); 
            return true;
        }
    }, [dataSource, apiCall, showNotify, t]);

    const updateProduct = useCallback(async (p: Product): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/products', 'POST', p);
            if (res && res.success) { 
                setProducts(prev => prev.map(x => x.id === p.id ? p : x)); 
                showNotify(t('notification.db_saved')); 
                return true; 
            }
            return false;
        } else {
            setProducts(prev => prev.map(x => x.id === p.id ? p : x)); 
            return true;
        }
    }, [dataSource, apiCall, showNotify, t]);

    const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall(`/api/products/${id}`, 'DELETE');
            if (res && res.success) { 
                setProducts(prev => prev.filter(x => x.id !== id)); 
                showNotify(t('notification.db_saved')); 
                return true; 
            }
            return false;
        } else {
            setProducts(prev => prev.filter(x => x.id !== id)); 
            return true;
        }
    }, [dataSource, apiCall, showNotify, t]);

    const searchProducts = useCallback(async (filters: any) => {
        if (dataSource === 'api') {
            const q = new URLSearchParams(filters).toString();
            const res = await apiCall(`/api/products?${q}`, 'GET');
            if (res && res.success) return res;
            return { products: [], total: 0, page: 1, pages: 1 };
        } else {
            // Local fallback logic
            let filtered = [...products];

            // Search (Name)
            if (filters.search) {
                const term = filters.search.toLowerCase();
                filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
            }

            // Price
            if (filters.minPrice) {
                filtered = filtered.filter(p => p.price >= Number(filters.minPrice));
            }
            if (filters.maxPrice) {
                filtered = filtered.filter(p => p.price <= Number(filters.maxPrice));
            }

            // Categories (comma separated string in filters)
            if (filters.categories) {
                const catArray = filters.categories.split(',').filter((c: string) => c.trim() !== '');
                if (catArray.length > 0) {
                    filtered = filtered.filter(p => catArray.includes(p.category));
                }
            }

            // Visibility
            if (filters.visibility) {
                const visArray = filters.visibility.split(',').filter((v: string) => v.trim() !== '');
                if (visArray.length > 0) {
                     filtered = filtered.filter(p => {
                         if (visArray.includes('online') && p.visibility?.online) return true;
                         if (visArray.includes('store') && p.visibility?.store) return true;
                         if (visArray.includes('stand') && p.visibility?.stand) return true;
                         return false;
                     });
                }
            }

            // Event Product
            if (filters.isEvent === 'yes') filtered = filtered.filter(p => p.isEventProduct);
            if (filters.isEvent === 'no') filtered = filtered.filter(p => !p.isEventProduct);

            // No Packaging
            if (filters.noPackaging === 'yes') filtered = filtered.filter(p => p.noPackaging);
            if (filters.noPackaging === 'no') filtered = filtered.filter(p => !p.noPackaging);

            const page = Number(filters.page) || 1;
            const limit = Number(filters.limit) || 50;
            const startIndex = (page - 1) * limit;
            const paginated = filtered.slice(startIndex, startIndex + limit);

            return { 
                products: paginated, 
                total: filtered.length, 
                page: page, 
                pages: Math.ceil(filtered.length / limit) 
            };
        }
    }, [dataSource, apiCall, products]);

    // --- INGREDIENTS ---

    const addIngredient = useCallback(async (ingredient: Ingredient): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/ingredients', 'POST', ingredient);
            if (res && res.success) {
                setIngredients(prev => [...prev, ingredient]);
                showNotify('Surovina uložena.');
                return true;
            }
            return false;
        } else {
            setIngredients(prev => [...prev, ingredient]);
            showNotify('Surovina uložena (Lokálně).');
            return true;
        }
    }, [dataSource, apiCall, showNotify]);

    const updateIngredient = useCallback(async (ingredient: Ingredient): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/ingredients', 'POST', ingredient);
            if (res && res.success) {
                setIngredients(prev => prev.map(i => i.id === ingredient.id ? ingredient : i));
                showNotify('Surovina upravena.');
                return true;
            }
            return false;
        } else {
            setIngredients(prev => prev.map(i => i.id === ingredient.id ? ingredient : i));
            return true;
        }
    }, [dataSource, apiCall, showNotify]);

    const deleteIngredient = useCallback(async (id: string): Promise<boolean> => {
        // Enforce Referential Integrity Check
        const isUsed = products.some(p => p.composition?.some(c => c.ingredientId === id));
        if (isUsed) {
            showNotify('Surovinu nelze smazat, protože je použita v produktech.', 'error');
            return false;
        }

        if (dataSource === 'api') {
            const res = await apiCall(`/api/ingredients/${id}`, 'DELETE');
            if (res && res.success) {
                setIngredients(prev => prev.filter(i => i.id !== id));
                showNotify('Surovina smazána.');
                return true;
            }
            return false;
        } else {
            setIngredients(prev => prev.filter(i => i.id !== id));
            return true;
        }
    }, [dataSource, apiCall, showNotify, products]);

    return {
        products,
        setProducts,
        ingredients,
        setIngredients,
        addProduct,
        updateProduct,
        deleteProduct,
        searchProducts,
        addIngredient,
        updateIngredient,
        deleteIngredient
    };
};


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
            // Local fallback
            return { products: products, total: products.length, page: 1, pages: 1 };
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

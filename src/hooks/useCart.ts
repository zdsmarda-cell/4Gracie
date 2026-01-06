
import { useState, useEffect } from 'react';
import { CartItem, Product } from '../types';

export const useCart = (showNotify: (msg: string) => void) => {
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const item = localStorage.getItem('cart');
            return item ? JSON.parse(item) : [];
        } catch { return []; }
    });
    const [cartBump, setCartBump] = useState(false);

    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = (product: Product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
            }
            return [...prev, { ...product, quantity }];
        });
        setCartBump(true);
        setTimeout(() => setCartBump(false), 300);
        // Positive notification removed as per request
        // if (showNotify) showNotify(`Produkt "${product.name}" přidán do košíku`);
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const updateCartItemQuantity = (id: string, quantity: number) => {
        if (quantity < 1) {
            removeFromCart(id);
            return;
        }
        setCart(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
    };

    const clearCart = () => setCart([]);

    return {
        cart,
        cartBump,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,
        clearCart
    };
};

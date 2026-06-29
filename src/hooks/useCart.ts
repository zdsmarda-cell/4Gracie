import React, { useState } from 'react';
import { CartItem, Product } from '../types';

export const useCart = (
    cart: CartItem[],
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>,
    showNotify: (msg: string) => void
) => {
    const [cartBump, setCartBump] = useState(false);

    const addToCart = (product: Product, quantity = 1, sliced?: boolean) => {
        setCart(prev => {
            // Find an item with the same ID AND the same sliced state. 
            // If they differ by sliced state, we could either keep them separate (requires unique cart IDs) 
            // or just merge and keep the latest sliced state. Merging is safer for simple ID-based cart.
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity, sliced: sliced !== undefined ? sliced : item.sliced } : item);
            }
            return [...prev, { ...product, quantity, sliced }];
        });
        setCartBump(true);
        setTimeout(() => setCartBump(false), 300);
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

    const updateCartItemSliced = (id: string, sliced: boolean) => {
        setCart(prev => prev.map(item => item.id === id ? { ...item, sliced } : item));
    };

    const clearCart = () => setCart([]);

    return {
        cart,
        cartBump,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,
        updateCartItemSliced,
        clearCart
    };
};
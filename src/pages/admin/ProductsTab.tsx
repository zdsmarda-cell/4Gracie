
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { ALLERGENS } from '../../constants';
import { generateTranslations } from '../../utils/aiTranslator';
import { Plus, Edit, Trash2, ImageIcon, Check, X, Languages, Globe, Upload, Layers, Search, AlertCircle, Filter } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { MultiSelect } from '../../components/MultiSelect';

const TranslationViewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    item: Product | null;
}> = ({ isOpen, onClose, item }) => {
    if (!isOpen || !item || !item.translations) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-xl font-serif font-bold text-primary flex items-center">
                        <Globe className="mr-2 text-accent" size={24}/> 
                        Překlady
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20}/></button>
                </div>

                <div className="space-y-6">
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                        <h4 className="font-bold text-blue-800 mb-3 flex items-center">
                            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mr-2">EN</span> 
                            English
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] font-bold text-blue-400 uppercase block mb-1">Name</span>
                                <p className="text-sm font-medium text-gray-800">{item.translations.en?.name || '-'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-blue-400 uppercase block mb-1">Description</span>
                                <p className="text-sm text-gray-600 leading-relaxed">{item.translations.en?.description || '-'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-50/50 rounded-xl p-4 border border-yellow-100">
                        <h4 className="font-bold text-yellow-800 mb-3 flex items-center">
                            <span className="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded mr-2">DE</span> 
                            Deutsch
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] font-bold text-yellow-500 uppercase block mb-1">Name</span>
                                <p className="text-sm font-medium text-gray-800">{item.translations.de?.name || '-'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-yellow-500 uppercase block mb-1">Description</span>
                                <p className="text-sm text-gray-600 leading-relaxed">{item.translations.de?.description || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t flex justify-end">
                    <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-bold text-sm transition">Zavřít</button>
                </div>
            </div>
        </div>
    );
};

export const ProductsTab: React.FC = () => {
    const { products, t, addProduct, updateProduct, deleteProduct, settings, uploadImage, getImageUrl } = useStore();
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{type: string, id: string, name?: string} | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [viewingTranslations, setViewingTranslations] = useState<Product | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    
    // Filters & Pagination
    const [filters, setFilters] = useState({ name: '', category: '', subcategory: '', event: 'all', online: 'all' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    const capCategories = useMemo(() => settings.capacityCategories || [], [settings.capacityCategories]);
    
    const getCategoryName = (id: string) => sortedCategories.find(c => c.id === id)?.name || id;

    // Helper class to hide spinners on number inputs
    const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    // Derived subcategories for current editing product's category
    const activeSubcategories = useMemo(() => {
        if (!editingProduct?.category) return [];
        const cat = sortedCategories.find(c => c.id === editingProduct.category);
        if (!cat || !cat.subcategories) return [];
        
        // Normalize: if string, convert to simple obj for consistent mapping
        return cat.subcategories.map(s => 
            typeof s === 'string' ? { id: s, name: s, enabled: true } : s
        ).filter(s => s.enabled);
    }, [editingProduct?.category, sortedCategories]);

    const handleAddClick = () => {
        setSaveError(null);
        setEditingProduct({
            category: sortedCategories[0]?.id || '', 
            unit: 'ks', 
            visibility: { online: true, store: true, stand: true },
            allergens: [],
            images: [],
            price: 0,
            vatRateInner: 12,
            vatRateTakeaway: 12,
            workload: 0,
            workloadOverhead: 0,
            volume: 0,
            noPackaging: false,
            capacityCategoryId: undefined,
            isEventProduct: false,
            subcategory: ''
        });
        setIsProductModalOpen(true);
    };

    const saveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError(null);
        if (!editingProduct) return;
        
        const prod = { ...editingProduct } as Product;

        // --- VALIDACE KAPACITNÍ KATEGORIE ---
        if (prod.capacityCategoryId) {
            const conflictingProduct = products.find(p => 
                p.capacityCategoryId === prod.capacityCategoryId && 
                p.category !== prod.category &&
                p.id !== prod.id
            );
            
            if (conflictingProduct) {
                const catName = getCategoryName(conflictingProduct.category);
                const capName = capCategories.find(c => c.id === prod.capacityCategoryId)?.name || prod.capacityCategoryId;
                setSaveError(`Kapacitní skupina "${capName}" je již používána v kategorii "${catName}". Všechny produkty sdílející stejnou kapacitu musí patřit do stejné hlavní kategorie.`);
                return;
            }
        }

        // --- VALIDACE PODKATEGORIE ---
        const catDef = sortedCategories.find(c => c.id === prod.category);
        const subCats = catDef?.subcategories || [];
        
        if (subCats.length > 0) {
            // Normalize IDs for check
            const validIds = subCats.map(s => typeof s === 'string' ? s : s.id);
            if (!prod.subcategory || !validIds.includes(prod.subcategory)) {
                setSaveError(`Pro kategorii "${catDef?.name}" je nutné vybrat platnou podkategorii.`);
                return;
            }
        } else {
            // Clear subcategory if main category has none
            prod.subcategory = undefined;
        }
        
        setIsUploading(true); 
        
        try {
            if (!prod.id) prod.id = Date.now().toString();
            
            if (prod.images && prod.images.length > 0) {
                const processedImages = await Promise.all(prod.images.map(async (img, index) => {
                    if (img.startsWith('data:')) {
                        try {
                            const fileName = `prod-${prod.id}-${Date.now()}-${index}.jpg`;
                            return await uploadImage(img, fileName);
                        } catch (err) {
                            console.error("Failed to upload image:", err);
                            return img; 
                        }
                    }
                    return img;
                }));
                prod.images = processedImages;
            } else {
                prod.images = [];
            }

            if (!prod.category && sortedCategories.length > 0) prod.category = sortedCategories[0].id;
            if (!prod.unit) prod.unit = 'ks';
            if (!prod.visibility) prod.visibility = { online: true, store: true, stand: true };
            if (!prod.allergens) prod.allergens = [];
            
            prod.vatRateInner = Number(prod.vatRateInner ?? 0);
            prod.vatRateTakeaway = Number(prod.vatRateTakeaway ?? 0);
            prod.workload = Number(prod.workload ?? 0);
            prod.workloadOverhead = Number(prod.workloadOverhead ?? 0);
            prod.volume = Number(prod.volume ?? 0); 
            
            if (settings.enableAiTranslation) {
                setIsTranslating(true);
                const translations = await generateTranslations({ 
                    name: prod.name, 
                    description: prod.description 
                });
                prod.translations = translations;
                setIsTranslating(false);
            }

            if (products.some(p => p.id === prod.id)) await updateProduct(prod);
            else await addProduct(prod);
            
            setIsProductModalOpen(false);
        } catch (e) {
            console.error("Save error:", e);
            setSaveError("Chyba při ukládání produktu na server.");
        } finally {
            setIsUploading(false);
            setIsTranslating(false);
        }
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingProduct) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setEditingProduct(prev => ({ ...prev, images: [...(prev?.images || []), base64] }));
            };
            reader.readAsDataURL(file);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            if (filters.name && !p.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
            
            // Subcategory filter text match
            if (filters.subcategory) {
                const term = filters.subcategory.toLowerCase();
                // We compare against ID or try to find name
                const cat = sortedCategories.find(c => c.id === p.category);
                const subObj = cat?.subcategories?.find(s => (typeof s === 'string' ? s : s.id) === p.subcategory);
                const subName = typeof subObj === 'string' ? subObj : subObj?.name || p.subcategory || '';
                
                if (!subName.toLowerCase().includes(term)) return false;
            }
            
            // Multi-category check
            if (filters.category) {
                const selectedCats = filters.category.split(',');
                if (selectedCats.length > 0 && !selectedCats.includes(p.category)) {
                    return false;
                }
            }

            if (filters.event !== 'all') {
                if (filters.event === 'yes' && !p.isEventProduct
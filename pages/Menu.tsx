
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { ALLERGENS } from '../constants';
import { ProductCategory, Product } from '../types';
import { Filter, Info, ChevronLeft, ChevronRight, X, Maximize2, Clock } from 'lucide-react';

const ProductImageGallery: React.FC<{ product: Product }> = ({ product }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const handleOpenZoom = () => {
    setIsZoomed(true);
  };

  if (!product.images || product.images.length === 0) {
    return (
      <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">
        No image
      </div>
    );
  }

  return (
    <>
      <div 
        className="relative h-48 overflow-hidden group/gallery cursor-pointer"
        onClick={handleOpenZoom}
        title="Kliknutím zvětšíte"
      >
        <img 
          src={product.images[currentIndex]} 
          alt={product.name} 
          className="w-full h-full object-cover transition duration-500 group-hover/gallery:scale-105" 
        />
        
        {/* Zoom Hint Icon */}
        <div className="absolute inset-0 bg-black/0 group-hover/gallery:bg-black/10 transition flex items-center justify-center">
          <Maximize2 className="text-white opacity-0 group-hover/gallery:opacity-100 transition shadow-sm" size={24} />
        </div>

        {product.images.length > 1 && (
          <>
            {/* Navigation Arrows */}
            <button 
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover/gallery:opacity-100 transition z-10"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover/gallery:opacity-100 transition z-10"
            >
              <ChevronRight size={18} />
            </button>

            {/* Image Counter Overlay */}
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white tracking-widest z-10">
              {currentIndex + 1} / {product.images.length}
            </div>
          </>
        )}

        {/* Allergen Overlay */}
        {product.allergens.length > 0 && (
          <div className="absolute top-2 left-2 bg-gray-200/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-gray-700 flex gap-1 z-10">
            {product.allergens.join(' ')}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <button 
            className="absolute top-6 right-6 text-white hover:text-accent transition p-2 bg-white/10 rounded-full hover:bg-white/20 z-[110]"
            onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
          >
            <X size={32} />
          </button>
          
          <div className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in duration-300">
             <img 
              src={product.images[currentIndex]} 
              alt={product.name} 
              className="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute -bottom-12 left-0 right-0 text-center">
              <h4 className="text-white font-serif text-xl font-bold">{product.name}</h4>
            </div>

            {product.images.length > 1 && (
              <>
                <button 
                  onClick={prevImage}
                  className="absolute -left-16 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition hidden md:block"
                >
                  <ChevronLeft size={48} />
                </button>
                <button 
                  onClick={nextImage}
                  className="absolute -right-16 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition hidden md:block"
                >
                  <ChevronRight size={48} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const Menu: React.FC = () => {
  const { t, addToCart, products } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [excludeAllergens, setExcludeAllergens] = useState<number[]>([]);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);

  // Determine active categories (categories with at least one active product)
  const activeCategories = useMemo(() => {
    const categories = new Set<ProductCategory>();
    products.forEach(p => {
      if (p.visibility?.online) {
        categories.add(p.category);
      }
    });
    // Return only categories that are in the Set and maintain order from Enum
    return Object.values(ProductCategory).filter(cat => categories.has(cat));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Safety check: p.visibility might be undefined if data is corrupted (e.g. bad import)
      if (!p.visibility?.online) return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (excludeAllergens.length > 0) {
        const hasExcludedAllergen = p.allergens.some(a => excludeAllergens.includes(a));
        if (hasExcludedAllergen) return false;
      }
      return true;
    });
  }, [selectedCategory, excludeAllergens, products]);

  const toggleAllergen = (id: number) => {
    setExcludeAllergens(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      {/* Hero Section */}
      <div className="bg-primary text-white py-12 px-4 text-center border-b-4 border-accent">
        {/* LOGO ONLY */}
        <div className="flex justify-center">
           <img 
             src="/logo.png" 
             alt="4Gracie Catering" 
             className="h-40 md:h-56 object-contain drop-shadow-2xl"
           />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        
        {/* Filters Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${selectedCategory === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t('filter.all')}
              </button>
              {activeCategories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {t(`cat.${cat}`)}
                </button>
              ))}
            </div>

            {/* Allergen Toggle */}
            <button 
              onClick={() => setShowAllergenFilter(!showAllergenFilter)}
              className="flex items-center text-gray-600 hover:text-primary"
            >
              <Filter size={18} className="mr-2" />
              <span>{t('filter.no_allergens')}</span>
            </button>
          </div>

          {/* Allergen Checkboxes */}
          {showAllergenFilter && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-300">
              {ALLERGENS.map(allergen => (
                <label key={allergen.id} className="flex items-center space-x-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={excludeAllergens.includes(allergen.id)}
                    onChange={() => toggleAllergen(allergen.id)}
                    className="rounded text-primary focus:ring-accent border-gray-300"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-primary transition">
                    <span className="font-bold mr-1">{allergen.code}</span>
                    {allergen.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden group border border-gray-100 flex flex-col h-full">
              
              <ProductImageGallery product={product} />

              <div className="p-6 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-serif font-bold text-gray-900">{product.name}</h3>
                  <span className="text-lg font-bold text-accent whitespace-nowrap ml-2">{product.price} Kč</span>
                </div>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-grow">{product.description}</p>
                
                <div className="flex flex-col space-y-3 mt-auto">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                    <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                      <Info size={14} className="mr-1.5 text-gray-300" />
                      {t('common.leadTime')}: {product.leadTimeDays} d.
                    </div>
                    <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                      <Clock size={14} className="mr-1.5 text-gray-300" />
                      Spotřebujte do: {product.shelfLifeDays} d.
                    </div>
                  </div>
                  <button 
                    onClick={() => addToCart(product)}
                    className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-bold hover:bg-gray-800 transition shadow-sm active:scale-95"
                  >
                    {t('product.add')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
            <Filter size={48} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-400">Žádné produkty neodpovídají filtrům</h3>
          </div>
        )}
      </div>
    </div>
  );
};

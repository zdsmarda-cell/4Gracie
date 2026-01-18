
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ShoppingCart, User, Menu as MenuIcon, X } from 'lucide-react';
import { Language } from '../types';

export const Navbar: React.FC = () => {
  const { cart, language, setLanguage, user, t, logout, openAuthModal, settings, cartBump } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Fallback to all languages if settings not loaded or empty array
  const availableLanguages = (settings.enabledLanguages && settings.enabledLanguages.length > 0) 
    ? settings.enabledLanguages 
    : Object.values(Language);

  const handleAuthClick = () => {
      if (user) {
          navigate('/profile');
      } else {
          openAuthModal();
      }
      setIsMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          
          {/* Logo Section */}
          <div className="flex items-center">
             <Link to="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                <img src="/logo.png" className="h-8 w-auto md:h-10" alt="4Gracie" />
                <span className="font-serif font-bold text-lg md:text-xl text-primary hidden min-[360px]:block">4grácie</span>
             </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-accent font-medium transition">{t('nav.menu')}</Link>
            
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-red-600 font-bold hover:text-red-800 transition">{t('nav.admin')}</Link>
            )}

            {user?.role === 'driver' && (
              <Link to="/driver" className="text-blue-600 font-bold hover:text-blue-800 transition">{t('nav.driver')}</Link>
            )}
            
            {/* Language Switcher */}
            {availableLanguages.length > 1 && (
                <div className="flex space-x-2 text-sm">
                {availableLanguages.map((lang) => (
                    <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-2 py-1 rounded ${language === lang ? 'bg-gray-200 font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                    {lang.toUpperCase()}
                    </button>
                ))}
                </div>
            )}

            {/* Auth */}
            {user ? (
               <div className="flex items-center space-x-4">
                 <Link to="/profile" className="flex items-center text-gray-700 hover:text-accent">
                   <User size={20} className="mr-1" />
                   <span className="text-sm font-medium">{user.name}</span>
                 </Link>
                 <button onClick={() => { logout(); navigate('/'); }} className="text-xs text-gray-500 underline">Log out</button>
               </div>
            ) : (
              <button onClick={openAuthModal} className="text-gray-700 hover:text-accent font-medium">
                {t('nav.login')}
              </button>
            )}

            {/* Cart */}
            <Link 
              to="/cart" 
              className={`relative p-2 text-gray-700 hover:text-accent transition-transform duration-200 ${cartBump ? 'scale-125 text-accent' : ''}`}
            >
              <ShoppingCart size={24} />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-accent rounded-full">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile Right Side Actions (Always Visible) */}
          <div className="flex items-center gap-1 md:hidden">
            {/* 1. Auth Icon (Mobile) */}
            <button 
                onClick={handleAuthClick}
                className={`p-2 rounded-full transition ${user ? 'text-accent bg-purple-50' : 'text-gray-600'}`}
            >
                <User size={22} />
            </button>

            {/* 2. Cart Icon (Mobile) */}
            <Link 
              to="/cart" 
              className={`relative p-2 text-gray-700 hover:text-accent transition-transform duration-200 ${cartBump ? 'scale-125 text-accent' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <ShoppingCart size={22} />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-accent rounded-full min-w-[16px]">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* 3. Hamburger Menu Trigger */}
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-700 ml-1">
              {isMobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-xl absolute w-full left-0 z-40 animate-in slide-in-from-top-2 duration-200">
          <div className="px-4 pt-4 pb-6 space-y-3">
             <Link to="/" className="block px-3 py-3 rounded-xl bg-gray-50 text-base font-bold text-gray-700 hover:text-accent" onClick={() => setIsMobileMenuOpen(false)}>
                {t('nav.menu')}
             </Link>
             
             {user?.role === 'admin' && (
                <Link to="/admin" className="block px-3 py-3 rounded-xl bg-red-50 text-base font-bold text-red-600" onClick={() => setIsMobileMenuOpen(false)}>
                    {t('nav.admin')}
                </Link>
             )}

             {user?.role === 'driver' && (
                <Link to="/driver" className="block px-3 py-3 rounded-xl bg-blue-50 text-base font-bold text-blue-600" onClick={() => setIsMobileMenuOpen(false)}>
                    {t('nav.driver')}
                </Link>
             )}

             {/* Mobile Language Switcher */}
             {availableLanguages.length > 1 && (
                <div className="px-3 py-2">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Jazyk / Language</p>
                    <div className="flex gap-2">
                        {availableLanguages.map((lang) => (
                            <button
                                key={lang}
                                onClick={() => setLanguage(lang)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${language === lang ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                {lang.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
             )}

             {user ? (
                 <div className="mt-4 pt-4 border-t border-gray-100">
                     <div className="flex items-center px-3 mb-4">
                         <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent mr-3">
                             <User size={20}/>
                         </div>
                         <div>
                             <p className="text-sm font-bold text-gray-900">{user.name}</p>
                             <p className="text-xs text-gray-500">{user.email}</p>
                         </div>
                     </div>
                     <button 
                        onClick={() => { logout(); setIsMobileMenuOpen(false); navigate('/'); }} 
                        className="w-full text-left px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition"
                     >
                        Odhlásit se
                     </button>
                 </div>
             ) : (
                 <div className="pt-2">
                    <button 
                        onClick={() => { openAuthModal(); setIsMobileMenuOpen(false); }} 
                        className="w-full text-center px-3 py-3 bg-primary text-white rounded-xl text-base font-bold shadow-lg"
                    >
                        {t('nav.login')}
                    </button>
                 </div>
             )}
          </div>
        </div>
      )}
    </nav>
  );
};

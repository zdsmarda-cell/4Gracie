
import React from 'react';
import { useStore } from '../context/StoreContext';
import { MapPin, Phone, Mail, FileText, ArrowLeft, Building, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Contacts: React.FC = () => {
  const { settings } = useStore();
  const { companyDetails } = settings;

  // Construct query for Google Maps embed
  const addressQuery = encodeURIComponent(`${companyDetails.street}, ${companyDetails.city}, ${companyDetails.zip}`);
  const mapUrl = `https://maps.google.com/maps?q=${addressQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 animate-fade-in">
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-accent transition mb-4">
          <ArrowLeft size={16} className="mr-1" /> Zpět na úvod
        </Link>
        <h1 className="text-3xl font-serif font-bold text-primary">Kontakty</h1>
        <p className="text-gray-500 mt-2">Jsme tu pro vás. Neváhejte nás kontaktovat nebo nás navštivte.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-8 h-full">
          
          <div>
            <h3 className="text-lg font-bold text-primary mb-4 border-b pb-2">Provozovatel</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <Building className="w-5 h-5 text-accent mr-3 mt-1" />
                <div>
                  <p className="font-bold text-gray-900">{companyDetails.name}</p>
                  <p className="text-sm text-gray-600">{companyDetails.street}</p>
                  <p className="text-sm text-gray-600">{companyDetails.zip} {companyDetails.city}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <FileText className="w-5 h-5 text-accent mr-3 mt-1" />
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-bold text-gray-400 w-10 inline-block">IČ:</span> {companyDetails.ic}</p>
                  {companyDetails.dic && (
                    <p><span className="font-bold text-gray-400 w-10 inline-block">DIČ:</span> {companyDetails.dic}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start">
                <CreditCard className="w-5 h-5 text-accent mr-3 mt-1" />
                <div className="text-sm text-gray-600">
                  <p className="font-bold text-gray-400 text-xs uppercase mb-1">Bankovní spojení</p>
                  <p className="font-mono font-bold text-gray-800">{companyDetails.bankAccount}</p>
                  {companyDetails.bic && <p className="text-xs text-gray-400">BIC/SWIFT: {companyDetails.bic}</p>}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-primary mb-4 border-b pb-2">Spojení</h3>
            <div className="space-y-4">
              <a href={`tel:${companyDetails.phone.replace(/\s/g, '')}`} className="flex items-center group">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center mr-3 group-hover:bg-green-100 transition">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">Telefon</p>
                  <p className="text-gray-900 font-medium group-hover:text-accent transition">{companyDetails.phone}</p>
                </div>
              </a>

              <a href={`mailto:${companyDetails.email}`} className="flex items-center group">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-3 group-hover:bg-blue-100 transition">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">Email</p>
                  <p className="text-gray-900 font-medium group-hover:text-accent transition">{companyDetails.email}</p>
                </div>
              </a>
            </div>
          </div>

        </div>

        {/* Map */}
        <div className="bg-gray-100 rounded-2xl shadow-inner border overflow-hidden min-h-[400px] relative">
            <iframe 
                width="100%" 
                height="100%" 
                className="absolute inset-0 border-0"
                src={mapUrl}
                allowFullScreen 
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow text-xs font-bold text-gray-600 pointer-events-none">
                <MapPin size={12} className="inline mr-1 text-red-500"/>
                {companyDetails.street}, {companyDetails.city}
            </div>
        </div>
      </div>
    </div>
  );
};

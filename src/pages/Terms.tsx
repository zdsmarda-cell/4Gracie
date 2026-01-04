
import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TermsContent } from '../components/TermsContent';

export const Terms: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-accent transition mb-4">
          <ArrowLeft size={16} className="mr-1" /> Zpět na úvod
        </Link>
        <h1 className="text-3xl font-serif font-bold text-primary flex items-center">
          <FileText className="mr-3 text-accent" /> Obchodní podmínky
        </h1>
        <div className="mt-2 text-sm text-gray-600">
          <p><strong>Obchodní společnosti:</strong> Šárka Šmardová</p>
          <p><strong>Sídlo:</strong> Neslovicá 411, 664 17 Tetčice</p>
          <p><strong>IČ:</strong> 01303562</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border">
        <TermsContent />
      </div>
    </div>
  );
};

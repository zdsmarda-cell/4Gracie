
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    limit: number;
    onLimitChange: (limit: number) => void;
    totalItems: number;
}

export const Pagination: React.FC<PaginationProps> = ({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    limit, 
    onLimitChange, 
    totalItems 
}) => {
    return (
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-t bg-gray-50 text-xs text-gray-600 gap-4">
            <div className="font-medium">
                Zobrazeno {(currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, totalItems)} z {totalItems} záznamů
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span>Počet na stránku:</span>
                    <select 
                        className="border rounded p-1 bg-white focus:ring-accent outline-none"
                        value={limit}
                        onChange={(e) => onLimitChange(Number(e.target.value))}
                    >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="font-mono font-bold px-2">{currentPage} / {totalPages}</span>
                    <button 
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-1 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

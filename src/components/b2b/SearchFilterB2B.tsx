import { Search, Filter, X } from 'lucide-react';
import { B2BFilters } from '@/types/b2b';
import { useState } from 'react';

interface SearchFilterB2BProps {
  filters: B2BFilters;
  onFiltersChange: (filters: B2BFilters) => void;
  categories: Array<{ id: string; nombre: string }>;
}

const SearchFilterB2B = ({ filters, onFiltersChange, categories }: SearchFilterB2BProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasActiveFilters = filters.searchQuery || filters.category || filters.stockStatus !== 'all';

  const handleClearFilters = () => {
    onFiltersChange({
      searchQuery: '',
      category: null,
      stockStatus: 'all',
      sortBy: 'newest',
    });
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold">Filtros</h2>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              Activos
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition"
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Búsqueda por SKU o Nombre */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            SKU o Nombre
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Ej: SKU-001"
              value={filters.searchQuery}
              onChange={(e) =>
                onFiltersChange({ ...filters, searchQuery: e.target.value })
              }
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Categoría
          </label>
          <select
            value={filters.category || ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                category: e.target.value || null,
              })
            }
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            <option value="">Todas</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Estatus de Stock */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Disponibilidad
          </label>
          <select
            value={filters.stockStatus}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                stockStatus: e.target.value as B2BFilters['stockStatus'],
              })
            }
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            <option value="all">Todos</option>
            <option value="in_stock">En Stock</option>
            <option value="low_stock">Stock Bajo</option>
            <option value="out_of_stock">Agotado</option>
          </select>
        </div>

        {/* Ordenar Por */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Ordenar
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                sortBy: e.target.value as B2BFilters['sortBy'],
              })
            }
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            <option value="newest">Más Nuevo</option>
            <option value="price_asc">Precio ↑</option>
            <option value="price_desc">Precio ↓</option>
            <option value="moq_asc">MOQ ↑</option>
            <option value="moq_desc">MOQ ↓</option>
          </select>
        </div>
      </div>
      
      {/* Botón Filtros Avanzados */}
      <div className="mt-2 flex justify-end">
         <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
         >
            {showAdvanced ? 'Menos' : 'Más opciones'}
            <Filter className="w-3 h-3" />
         </button>
      </div>
      
      {showAdvanced && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-center text-xs text-gray-500">
            No hay filtros adicionales disponibles.
        </div>
      )}
    </div>
  );
};

export default SearchFilterB2B;

import './Header.css';

interface HeaderProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: (v: string) => void;
  city?: string;
}

export function Header({ searchValue, onSearchChange, onSearchSubmit, city = 'Porto Alegre' }: HeaderProps) {
  return (
    <header className="header" role="banner">
      <div className="header__brand">
        <span className="header__logo" aria-hidden="true">🧭</span>
        <span className="header__title">EchoPatch</span>
      </div>

      <div className="header__search">
        <label htmlFor="search-input" className="sr-only">Buscar destino</label>
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input
          id="search-input"
          type="search"
          className="search-input"
          placeholder={`Buscar destino em ${city}...`}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit(searchValue)}
          aria-label={`Buscar destino em ${city}`}
          autoComplete="off"
        />
      </div>

      <div className="header__user">
        <button className="header-btn" aria-label="Câmera / Modo AR">📷</button>
        <button className="header-btn" aria-label="Perfil do usuário">👤</button>
      </div>
    </header>
  );
}

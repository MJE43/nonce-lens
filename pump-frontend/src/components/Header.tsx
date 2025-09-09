import { NavLink } from "react-router-dom";

const Header = () => {
  return (
    <header
      className="border-b"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-x-8">
            <h1 className="text-lg font-semibold text-white">
              Pump Analyzer Web
            </h1>
            <nav className="flex items-center gap-x-6 text-sm">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `hover:text-white transition-colors ${
                    isActive ? "text-white" : "text-gray-400"
                  }`
                }
              >
                Runs
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center">
            <NavLink
              to="/new"
              className="rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: "var(--color-primary-600)" }}
            >
              New Run
            </NavLink>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

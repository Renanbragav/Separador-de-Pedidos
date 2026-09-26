import React, { useState } from 'react';
import {
  UserCheck,
  ChevronDown,
  Layers,
  Calendar,
  Key,
  ShieldCheck,
  Lock,
  AlertCircle,
  PackageCheck,
  X,
} from 'lucide-react';
import {
  UserProfile,
  VENDEDORES,
  ESTOQUE_USERS,
  ADMIN_USERS,
} from '../types';
import { AuthStore } from '../services/authStore';
import { PasswordManagementModal } from './PasswordManagementModal';

interface HeaderProps {
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
  activeOrdersCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSelectUser,
  activeOrdersCount,
}) => {
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showPasswordAdminModal, setShowPasswordAdminModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const isAdmin =
    currentUser.role === 'admin' ||
    AuthStore.isAdmin(currentUser.name);

  const currentDateFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handleSelectUserClick = (targetUser: UserProfile) => {
    // If selecting the exact same user that is already logged in, no need to re-verify
    if (targetUser.name === currentUser.name && targetUser.role === currentUser.role) {
      setShowSwitchModal(false);
      return;
    }
    setPendingUser(targetUser);
    setPasswordInput('');
    setLoginError(null);
  };

  const handleConfirmPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;

    if (AuthStore.verifyPassword(pendingUser.name, passwordInput)) {
      onSelectUser(pendingUser);
      AuthStore.saveCurrentUser(pendingUser);
      setPendingUser(null);
      setShowSwitchModal(false);
      setPasswordInput('');
      setLoginError(null);
    } else {
      setLoginError('Senha incorreta. Tente novamente ou peça suporte aos administradores Renan/Ilma.');
    }
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20 border border-blue-400/30">
            E
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              EXPEDIÇÃO
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wide">
                VitSis • Matriz Padrão
              </span>
            </h1>
            <p className="text-xs text-slate-400 capitalize flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentDateFormatted}</span>
            </p>
          </div>
        </div>

        {/* User Role, Admin Tools & Switcher Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Admin Password Management Button (Only Renan and Ilma) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowPasswordAdminModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Configurar senhas de todos os usuários (Exclusivo Renan / Ilma)"
            >
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Configurar Senhas</span>
            </button>
          )}

          {/* Active Queue Summary */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300">Pedidos na Fila:</span>
            <strong className="text-white font-bold">{activeOrdersCount}</strong>
          </div>

          {/* User Profile Badge Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setPendingUser(null);
                setPasswordInput('');
                setLoginError(null);
                setShowSwitchModal(true);
              }}
              className="flex items-center gap-3 px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-white transition-all shadow-md group"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 shadow-sm ${
                  currentUser.role === 'admin'
                    ? 'bg-purple-600 border-purple-400 shadow-purple-500/20'
                    : currentUser.role === 'vendedor'
                    ? 'bg-blue-600 border-blue-400 shadow-blue-500/20'
                    : 'bg-emerald-600 border-emerald-400 shadow-emerald-500/20'
                }`}
              >
                {currentUser.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {currentUser.role === 'admin'
                    ? 'Administrador'
                    : currentUser.role === 'vendedor'
                    ? 'Painel Vendedor'
                    : 'Equipe Estoque'}
                </p>
                <p className="text-xs font-bold text-slate-100 flex items-center gap-1">
                  {currentUser.name}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform" />
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* User Selector & Password Login Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-white space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-400" />
                  Acessar Painel por Usuário
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selecione seu perfil e informe sua senha de acesso.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSwitchModal(false);
                  setPendingUser(null);
                }}
                className="text-slate-400 hover:text-white text-xs font-semibold bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Password Prompt Sub-form if user selected */}
            {pendingUser ? (
              <form
                onSubmit={handleConfirmPasswordLogin}
                className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full text-white font-bold flex items-center justify-center text-sm border-2 ${
                      pendingUser.role === 'admin'
                        ? 'bg-purple-600 border-purple-400'
                        : pendingUser.role === 'vendedor'
                        ? 'bg-blue-600 border-blue-400'
                        : 'bg-emerald-600 border-emerald-400'
                    }`}
                  >
                    {pendingUser.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold">
                      Entrar no painel de:
                    </p>
                    <p className="text-sm font-bold text-white flex items-center gap-1.5">
                      {pendingUser.name}
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase">
                        {pendingUser.role}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Senha de Acesso:
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Padrão inicial: 1234
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      autoFocus
                      placeholder="Digite sua senha..."
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="p-2.5 bg-rose-950/50 border border-rose-800/60 rounded-lg flex items-center gap-2 text-xs text-rose-300 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingUser(null);
                      setPasswordInput('');
                      setLoginError(null);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all"
                  >
                    Acessar Painel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* Administradores Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    Administradores (Acesso Total)
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {ADMIN_USERS.map((adm) => {
                      const isCurrent =
                        currentUser.role === 'admin' &&
                        currentUser.name === adm;
                      return (
                        <button
                          key={adm}
                          type="button"
                          onClick={() =>
                            handleSelectUserClick({ role: 'admin', name: adm })
                          }
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-all flex items-center gap-2 ${
                            isCurrent
                              ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400'
                              : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-purple-950/40 hover:border-purple-600'
                          }`}
                        >
                          <div className="w-6 h-6 rounded bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                            {adm.charAt(0)}
                          </div>
                          <span className="truncate">{adm}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vendedores Section */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Vendedores (Visualizam os próprios pedidos)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {VENDEDORES.map((v) => {
                      const isCurrent =
                        currentUser.role === 'vendedor' &&
                        currentUser.name === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() =>
                            handleSelectUserClick({ role: 'vendedor', name: v })
                          }
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-all flex items-center gap-2 ${
                            isCurrent
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400'
                              : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {v.charAt(0)}
                          </div>
                          <span className="truncate">{v}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Estoque Section */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Equipe do Estoque (Fila de Separação Geral)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ESTOQUE_USERS.map((e) => {
                      const isCurrent =
                        currentUser.role === 'estoque' &&
                        currentUser.name === e;
                      return (
                        <button
                          key={e}
                          type="button"
                          onClick={() =>
                            handleSelectUserClick({ role: 'estoque', name: e })
                          }
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-all flex items-center gap-2 ${
                            isCurrent
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400'
                              : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {e.charAt(0)}
                          </div>
                          <span className="truncate">{e}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Management Modal (Exclusively Renan and Ilma) */}
      {showPasswordAdminModal && (
        <PasswordManagementModal
          adminName={currentUser.name}
          onClose={() => setShowPasswordAdminModal(false)}
        />
      )}
    </header>
  );
};

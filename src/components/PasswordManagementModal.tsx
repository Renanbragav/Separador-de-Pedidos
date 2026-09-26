import React, { useState } from 'react';
import { X, Key, ShieldCheck, Save, Check, Eye, EyeOff, UserCheck } from 'lucide-react';
import { VENDEDORES, ESTOQUE_USERS, ADMIN_USERS } from '../types';
import { AuthStore } from '../services/authStore';

interface PasswordManagementModalProps {
  adminName: string;
  onClose: () => void;
}

export const PasswordManagementModal: React.FC<PasswordManagementModalProps> = ({
  adminName,
  onClose,
}) => {
  const [passwords, setPasswords] = useState<Record<string, string>>(
    AuthStore.getAllPasswords()
  );
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [savedUser, setSavedUser] = useState<string | null>(null);

  const handlePasswordChange = (username: string, val: string) => {
    setPasswords((prev) => ({ ...prev, [username]: val }));
  };

  const handleSaveUserPassword = (username: string) => {
    const newPass = passwords[username] || '1234';
    AuthStore.updatePassword(username, newPass);
    setSavedUser(username);
    setTimeout(() => setSavedUser(null), 2000);
  };

  const toggleShowPassword = (username: string) => {
    setShowPasswords((prev) => ({ ...prev, [username]: !prev[username] }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-white space-y-6 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Gerenciamento de Senhas do Sistema
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30 uppercase">
                  Exclusivo ({adminName})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Somente os administradores Renan e Ilma podem definir e alterar as senhas de todos os usuários.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-semibold bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable list of user password inputs */}
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          {/* Administradores */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              Administradores (Acesso Total & Exclusão de Pedidos)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ADMIN_USERS.map((user) => (
                <div
                  key={user}
                  className="bg-slate-800/80 border border-purple-900/40 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-md">
                      {user.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">{user}</span>
                      <span className="text-[10px] text-purple-300">Admin</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative w-28">
                      <input
                        type={showPasswords[user] ? 'text' : 'password'}
                        value={passwords[user] || ''}
                        onChange={(e) => handlePasswordChange(user, e.target.value)}
                        className="w-full pl-2 pr-7 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword(user)}
                        className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-200"
                        title={showPasswords[user] ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPasswords[user] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveUserPassword(user)}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                        savedUser === user
                          ? 'bg-emerald-600 text-white'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                      title="Salvar senha"
                    >
                      {savedUser === user ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vendedores */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Vendedores
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VENDEDORES.map((user) => (
                <div
                  key={user}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                      {user.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">{user}</span>
                      <span className="text-[10px] text-slate-400">Vendedor(a)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative w-28">
                      <input
                        type={showPasswords[user] ? 'text' : 'password'}
                        value={passwords[user] || ''}
                        onChange={(e) => handlePasswordChange(user, e.target.value)}
                        className="w-full pl-2 pr-7 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword(user)}
                        className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-200"
                        title={showPasswords[user] ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPasswords[user] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveUserPassword(user)}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                        savedUser === user
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                      title="Salvar senha"
                    >
                      {savedUser === user ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estoque */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Equipe do Estoque
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ESTOQUE_USERS.map((user) => (
                <div
                  key={user}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                      {user.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">{user}</span>
                      <span className="text-[10px] text-slate-400">Estoque</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative w-28">
                      <input
                        type={showPasswords[user] ? 'text' : 'password'}
                        value={passwords[user] || ''}
                        onChange={(e) => handlePasswordChange(user, e.target.value)}
                        className="w-full pl-2 pr-7 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword(user)}
                        className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-200"
                        title={showPasswords[user] ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPasswords[user] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveUserPassword(user)}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                        savedUser === user
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                      title="Salvar senha"
                    >
                      {savedUser === user ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
          >
            Concluir Gerenciamento
          </button>
        </div>
      </div>
    </div>
  );
};

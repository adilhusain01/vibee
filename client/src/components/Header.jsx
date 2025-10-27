
import { Link } from "react-router-dom";
import { useEffect, useState } from 'react';
import { usePrivyAuth } from "../context/PrivyAuthContext";
import { Wallet, LogOut, User, Settings } from "lucide-react";
import Logo from "../assets/logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const Header = () => {
  const {
    walletAddress,
    disconnectWallet,
    network,
    authenticated,
    user,
    ready,
    login
  } = usePrivyAuth();

  const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    // Privy handles network switching automatically, so we don't need to track this
  }, [network]);

  const getUserDisplayName = () => {
    if (!user) return '';

    if (user.google?.name) return user.google.name;
    if (user.email?.address) return user.email.address;
    if (walletAddress) return truncateAddress(walletAddress);
    return 'User';
  };

  const getUserDisplayType = () => {
    if (!user) return '';

    if (user.google?.email) return `Google: ${user.google.email}`;
    if (user.email?.address) return `Email: ${user.email.address}`;
    return 'Wallet User';
  };

  if (!ready) {
    return (
      <nav className="px-4 md:px-24 h-20 md:h-24 flex items-center justify-between bg-white/5 backdrop-blur-lg border-b border-white/10">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative w-8 h-8 md:w-14 md:h-14 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-md md:rounded-xl md:p-2 transition-all duration-300 group-hover:scale-105">
            <img
              src={Logo}
              alt="Vibe Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl md:text-3xl font-bold">
            <span className="text-white">Vibe</span>
          </h1>
        </Link>
        <div className="animate-pulse bg-gray-300 h-10 w-32 rounded-xl"></div>
      </nav>
    );
  }

  return (
    <nav className="px-4 md:px-24 h-20 md:h-24 flex items-center justify-between bg-white/5 backdrop-blur-lg border-b border-white/10">
      <Link to="/" className="flex items-center gap-2 group">
        <div className="relative w-8 h-8 md:w-14 md:h-14 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-md md:rounded-xl md:p-2 transition-all duration-300 group-hover:scale-105">
          <img
            src={Logo}
            alt="Vibe Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-xl md:text-3xl font-bold">
          <span className="text-white">Vibe</span>
        </h1>
      </Link>

      <div className="relative">
        {authenticated && walletAddress ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 md:px-6 py-1 md:py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-md md:rounded-xl text-white font-medium hover:opacity-90 transition-all duration-300 shadow-lg shadow-red-500/25">
                <User size={20} />
                <span className="hidden md:block">{getUserDisplayName()}</span>
                <span className="md:hidden">{truncateAddress(walletAddress)}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-64 bg-white/10 backdrop-blur-lg border border-white/20"
              align="end"
            >
              <DropdownMenuLabel className="text-white">
                <div className="font-medium">{getUserDisplayName()}</div>
                <div className="text-gray-300 text-xs font-normal">{getUserDisplayType()}</div>
              </DropdownMenuLabel>
              
              {walletAddress && (
                <DropdownMenuLabel className="text-white">
                  <div className="text-gray-300 text-xs">Wallet Address:</div>
                  <div className="font-mono text-xs break-all font-normal">{walletAddress}</div>
                </DropdownMenuLabel>
              )}
              
              <DropdownMenuSeparator className="bg-white/20" />
              
              <DropdownMenuItem asChild className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer">
                <Link to="/profile" className="flex items-center gap-2">
                  <Settings size={16} />
                  Profile & Settings
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={disconnectWallet}
                className="text-red-400 hover:bg-red-500/20 focus:bg-red-500/20 focus:text-red-400 cursor-pointer"
              >
                <LogOut size={16} className="mr-2" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            onClick={login}
            className="flex items-center gap-2 px-3 md:px-6 py-1 md:py-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-md md:rounded-xl text-white font-medium hover:opacity-90 transition-all duration-300 shadow-lg shadow-red-500/25"
          >
            <Wallet size={20} />
            <span>Log In</span>
          </button>
        )}
      </div>

    </nav>
  );
};

export default Header;
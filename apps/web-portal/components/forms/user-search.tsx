'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Loader2, User } from 'lucide-react';

interface SlackUser {
  id: string;
  name: string;
  displayName: string;
  avatar?: string;
}

interface UserSearchProps {
  value: string;
  onChange: (userId: string, user?: SlackUser) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function UserSearch({ value, onChange, disabled, placeholder = 'Search for a user...' }: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SlackUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SlackUser | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch users on mount and when query changes
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/slack/users?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.users) {
          setUsers(data.users);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Find selected user when value changes externally
  useEffect(() => {
    if (value && !selectedUser) {
      const user = users.find(u => u.id === value);
      if (user) {
        setSelectedUser(user);
      }
    }
  }, [value, users, selectedUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (user: SlackUser) => {
    setSelectedUser(user);
    onChange(user.id, user);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    setSelectedUser(null);
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  };

  if (selectedUser && !disabled) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
        {selectedUser.avatar ? (
          <img
            src={selectedUser.avatar}
            alt={selectedUser.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selectedUser.displayName || selectedUser.name}</p>
          <p className="text-xs text-muted-foreground">{selectedUser.id}</p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Change
        </button>
      </div>
    );
  }

  if (disabled && value) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selectedUser?.displayName || selectedUser?.name || value}</p>
          <p className="text-xs text-muted-foreground">{value}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9"
          disabled={disabled}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {users.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {isLoading ? 'Loading users...' : 'No users found'}
            </div>
          ) : (
            <ul className="py-1">
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors',
                      value === user.id && 'bg-accent'
                    )}
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.displayName || user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.id}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

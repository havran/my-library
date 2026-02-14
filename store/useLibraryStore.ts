import { create } from "zustand";
import type { Book, BookSortField, SortDirection } from "@/types/book";
import * as database from "@/db/database";

interface LibraryState {
  books: Book[];
  searchQuery: string;
  sortField: BookSortField;
  sortDirection: SortDirection;
  theme: "light" | "dark";
  isLoading: boolean;

  loadBooks: () => Promise<void>;
  addBook: (book: Book) => Promise<void>;
  updateBook: (id: string, changes: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  toggleRead: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSortField: (field: BookSortField) => void;
  setSortDirection: (dir: SortDirection) => void;
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  exportBooks: () => Promise<string>;
  importBooks: (json: string) => Promise<number>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  searchQuery: "",
  sortField: "addedAt",
  sortDirection: "desc",
  theme: "light",
  isLoading: false,

  loadBooks: async () => {
    set({ isLoading: true });
    const books = await database.getAllBooks();
    set({ books, isLoading: false });
  },

  addBook: async (book: Book) => {
    await database.addBook(book);
    set((state) => ({ books: [...state.books, book] }));
  },

  updateBook: async (id: string, changes: Partial<Book>) => {
    await database.updateBook(id, changes);
    set((state) => ({
      books: state.books.map((b) =>
        b.id === id ? { ...b, ...changes, updatedAt: new Date().toISOString() } : b
      ),
    }));
  },

  deleteBook: async (id: string) => {
    await database.deleteBook(id);
    set((state) => ({ books: state.books.filter((b) => b.id !== id) }));
  },

  toggleRead: async (id: string) => {
    const book = get().books.find((b) => b.id === id);
    if (book) {
      const isRead = !book.isRead;
      await database.updateBook(id, { isRead });
      set((state) => ({
        books: state.books.map((b) => (b.id === id ? { ...b, isRead } : b)),
      }));
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSortField: (field: BookSortField) => set({ sortField: field }),
  setSortDirection: (dir: SortDirection) => set({ sortDirection: dir }),

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("my-library-theme", newTheme);
      } catch {}
      return { theme: newTheme };
    }),

  setTheme: (theme) => set({ theme }),

  exportBooks: async () => {
    return database.exportAllBooks();
  },

  importBooks: async (json: string) => {
    const count = await database.importBooks(json);
    await get().loadBooks();
    return count;
  },
}));

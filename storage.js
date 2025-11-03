// storage.js - Enhanced Storage Management for GMC App
class EnhancedStorage {
    constructor() {
        this.DB_NAME = 'GlovesManufactureDB';
        this.DB_VERSION = 2;
        this.STORE_NAME = 'appData';
        this.STORAGE_KEY = 'gloves-manufacture-month-v16';
        this.SETTINGS_KEY = 'gloves-settings-v2';
        this.PREFERENCES_KEY = 'gloves-preferences-v1';
        this.THEME_KEY = 'gloves-theme';
        this.PROFILE_IMAGE_KEY = 'gloves-profile-image';
        this.CALCULATOR_DATA_KEY = 'gloves-calculator-data';
        
        this.db = null;
        this.isIndexedDBSupported = this.checkIndexedDBSupport();
        this.init();
    }

    checkIndexedDBSupport() {
        try {
            return !!window.indexedDB;
        } catch (e) {
            return false;
        }
    }

    async init() {
        if (!this.isIndexedDBSupported) {
            console.log('IndexedDB not supported, using localStorage only');
            return;
        }

        try {
            this.db = await this.openDB();
            console.log('Enhanced Storage initialized with IndexedDB');
        } catch (error) {
            console.warn('IndexedDB initialization failed, using localStorage only:', error);
            this.isIndexedDBSupported = false;
        }
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onerror = () => {
                console.error('IndexedDB open error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                console.log('IndexedDB opened successfully');
                resolve(request.result);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
                    store.createIndex('key', 'key', { unique: true });
                }
            };

            request.onblocked = () => {
                console.warn('IndexedDB open blocked');
                reject(new Error('IndexedDB blocked'));
            };
        });
    }

    // Main save function with fallback
    async save(key, data) {
        // Use existing saveData function from index.html
        try {
            saveData(key, data);
            return { success: true, method: 'localStorage' };
        } catch (e) {
            if ((e.name === 'QuotaExceededError' || e.code === 22) && this.isIndexedDBSupported) {
                // Fallback to IndexedDB
                try {
                    await this.saveToIndexedDB(key, data);
                    return { success: true, method: 'indexedDB' };
                } catch (idbError) {
                    console.error('IndexedDB save failed:', idbError);
                    return { success: false, error: idbError };
                }
            }
            return { success: false, error: e };
        }
    }

    // Main load function with fallback
    async load(key) {
        // Use existing loadData function from index.html first
        try {
            const data = loadData(key);
            if (data !== null) {
                return data;
            }
        } catch (e) {
            console.warn('LocalStorage load failed, trying IndexedDB:', e);
        }

        // Fallback to IndexedDB
        if (this.isIndexedDBSupported) {
            try {
                const data = await this.loadFromIndexedDB(key);
                if (data) {
                    return data;
                }
            } catch (idbError) {
                console.error('IndexedDB load failed:', idbError);
            }
        }
        
        return null;
    }

    // IndexedDB specific functions
    async saveToIndexedDB(key, data) {
        if (!this.db && this.isIndexedDBSupported) {
            await this.init();
        }
        
        if (!this.db) {
            throw new Error('IndexedDB not available');
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            
            const request = store.put({
                key: key,
                data: data,
                timestamp: new Date().toISOString()
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadFromIndexedDB(key) {
        if (!this.db && this.isIndexedDBSupported) {
            await this.init();
        }
        
        if (!this.db) {
            throw new Error('IndexedDB not available');
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            
            const request = store.get(key);
            
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.data);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // Clear storage
    async clear(key = null) {
        try {
            if (key) {
                localStorage.removeItem(key);
                if (this.isIndexedDBSupported && this.db) {
                    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(this.STORE_NAME);
                    store.delete(key);
                }
            } else {
                localStorage.clear();
                if (this.isIndexedDBSupported && this.db) {
                    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(this.STORE_NAME);
                    store.clear();
                }
            }
            return { success: true };
        } catch (error) {
            console.error('Clear storage failed:', error);
            return { success: false, error: error };
        }
    }

    // Get storage info
    async getStorageInfo() {
        let localStorageSize = 0;
        let indexedDBSize = 0;
        
        // Calculate localStorage size
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    localStorageSize += localStorage[key].length * 2;
                }
            }
        } catch (e) {
            console.warn('Could not calculate localStorage size:', e);
        }
        
        return {
            localStorage: {
                size: localStorageSize,
                sizeMB: (localStorageSize / (1024 * 1024)).toFixed(2)
            },
            indexedDB: {
                size: indexedDBSize,
                sizeMB: (indexedDBSize / (1024 * 1024)).toFixed(2)
            },
            totalMB: ((localStorageSize + indexedDBSize) / (1024 * 1024)).toFixed(2)
        };
    }
}

// Create global instance with error handling
let enhancedStorage;
try {
    enhancedStorage = new EnhancedStorage();
} catch (error) {
    console.error('Failed to initialize EnhancedStorage:', error);
    // Fallback to simple object using existing functions
    enhancedStorage = {
        async save(key, data) {
            try {
                saveData(key, data);
                return { success: true, method: 'localStorage' };
            } catch (e) {
                return { success: false, error: e };
            }
        },
        async load(key) {
            try {
                return loadData(key);
            } catch (e) {
                return null;
            }
        },
        async clear(key = null) {
            try {
                if (key) {
                    localStorage.removeItem(key);
                } else {
                    localStorage.clear();
                }
                return { success: true };
            } catch (error) {
                return { success: false, error: error };
            }
        }
    };
}
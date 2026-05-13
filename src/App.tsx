import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Settings, 
  Plus, 
  Save, 
  Undo, 
  Trash2, 
  FileText, 
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Filter,
  Download,
  Printer,
  X,
  History,
  Box,
  Wallet,
  Menu,
  ShieldCheck,
  Check,
  Bell,
  Share2,
  Send,
  Minus,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Page, Product, Kontragent, SaleDoc, PurchaseDoc, Unit, DocStatus, DocRow, KontragentTur } from './types';
import { db, auth } from './firebase';
import { 
  doc, 
  getDoc,
  getDocFromServer, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  collection,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

// --- FIRESTORE ERROR HANDLING ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app we might want to show this to the user
  alert(`Xatolik (${operationType}): ` + (error instanceof Error ? error.message : "Noma'lum xatolik"));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection OK");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
  }
}
// --- END FIRESTORE ERROR HANDLING ---

// Helper for formatting numbers
const fmt = (n: number) => (Number(n) || 0).toLocaleString('uz-UZ');
const fmtSum = (n: number) => fmt(n) + " so'm";
const parseSum = (s: string) => parseInt(s.replace(/\D/g, '')) || 0;
const fmtInput = (v: any) => {
  const s = String(v).replace(/\D/g, '');
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// App Component
export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [activeReportTab, setActiveReportTab] = useState<'moliya' | 'haqdorler' | 'qarzdorlar' | 'ombor'>('moliya');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLogged, setIsLogged] = useState(false);
  const [companyName, setCompanyName] = useState('UPR');
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [kontragents, setKontragents] = useState<Kontragent[]>([]);
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [purchases, setPurchases] = useState<PurchaseDoc[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [kassa, setKassa] = useState<any[]>([]);
  const [editingSale, setEditingSale] = useState<SaleDoc | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseDoc | null>(null);
  const [salesFilter, setSalesFilter] = useState<string>('Barchasi');
  
  const productsWithBalances = useMemo(() => {
    return products.map(p => {
      const totalKirim = purchases.reduce((a: number, d: any) => 
        a + (d.rows || []).filter((r: any) => r.productId === p.id).reduce((sum: number, r: any) => sum + Number(r.miqdor || 0), 0), 0);
      const totalChiqim = sales.reduce((a: number, d: any) => 
        a + (d.rows || []).filter((r: any) => r.productId === p.id).reduce((sum: number, r: any) => sum + Number(r.miqdor || 0), 0), 0);
      return { ...p, qoldiq: totalKirim - totalChiqim };
    });
  }, [products, purchases, sales]);

  const companyKey = companyName.toUpperCase().trim().replace(/\s+/g, ' ');
  const unpaidPurchases = purchases.filter(p => p.tulovHolati === 'tolanmadi');
  const totalDebt = unpaidPurchases.reduce((acc, p) => acc + Number(p.jami || 0), 0);

  // Firestore Listeners
  useEffect(() => {
    if (!isLogged || !companyKey) return;

    testConnection();

    const unsubProducts = onSnapshot(collection(db, 'companies', companyKey, 'products'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setProducts(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'products'));

    const unsubKontragents = onSnapshot(collection(db, 'companies', companyKey, 'kontragents'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setKontragents(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'kontragents'));

    const unsubSales = onSnapshot(collection(db, 'companies', companyKey, 'sales'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setSales(data.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'sales'));

    const unsubPurchases = onSnapshot(collection(db, 'companies', companyKey, 'purchases'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setPurchases(data.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'purchases'));

    const unsubExpenses = onSnapshot(collection(db, 'companies', companyKey, 'expenses'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setExpenses(data.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'expenses'));

    const unsubKassa = onSnapshot(collection(db, 'companies', companyKey, 'kassa'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setKassa(data.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'kassa'));

    return () => {
      unsubProducts();
      unsubKontragents();
      unsubSales();
      unsubPurchases();
      unsubExpenses();
      unsubKassa();
    };
  }, [isLogged, companyKey]);

  // Firestore CRUD Helpers
  const fbSave = async (col: string, data: any) => {
    const path = `companies/${companyKey}/${col}`;
    try {
      const docId = data.id || doc(collection(db, 'companies', companyKey, col)).id;
      const finalData = {
        ...data,
        id: docId,
        updatedAt: serverTimestamp(),
        createdAt: data.createdAt || serverTimestamp()
      };

      await setDoc(doc(db, 'companies', companyKey, col, docId), finalData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const fbDelete = async (col: string, id: string) => {
    const path = `companies/${companyKey}/${col}/${id}`;
    try {
      await deleteDoc(doc(db, 'companies', companyKey, col, id));
      
      // After deletion, reorder remaining docs to maintain sequential numbering
      if (col === 'sales' || col === 'purchases') {
        const currentData = col === 'sales' ? sales : purchases;
        const remaining = currentData.filter(item => item.id !== id)
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        
        for (let i = 0; i < remaining.length; i++) {
          const newRaqam = (i + 1).toString();
          if (remaining[i].raqam !== newRaqam) {
            const dRef = doc(db, 'companies', companyKey, col, remaining[i].id);
            await setDoc(dRef, { raqam: newRaqam }, { merge: true });
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Initialize Auth
  useEffect(() => {
    // Ensuring we are signed in anonymously for Firestore rules
    // If this fails with 'auth/configuration-not-found', it means Anonymous Auth is not enabled in Firebase Console.
    signInAnonymously(auth).catch(err => {
      if (err.code === 'auth/configuration-not-found') {
        console.warn("Firebase: Anonymous Auth is not enabled in the Firebase Console. Please enable it to use this app with Firestore security rules.");
      } else {
        console.error("Auth error:", err);
      }
    });

    const userData = localStorage.getItem('sbt_user_data');
    if (userData) {
      const data = JSON.parse(userData);
      const cleanName = data.company.toUpperCase().trim().replace(/\s+/g, ' ');
      setCompanyName(cleanName);
      setIsLogged(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('sbt_user_data');
    setIsLogged(false);
  };

  const handleLogin = (name: string) => {
    const cleanName = name.toUpperCase().trim().replace(/\s+/g, ' ');
    localStorage.setItem('sbt_user_data', JSON.stringify({ company: cleanName }));
    setCompanyName(cleanName);
    setIsLogged(true);
  };

  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  // Notification Permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Payment Reminders
  useEffect(() => {
    if (!isLogged || (purchases.length === 0 && sales.length === 0)) return;

    const playSound = async () => {
      try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AudioContextClass) return;
        
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.type = 'triangle'; 
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
          
          gain.gain.setValueAtTime(0, audioCtx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + start + 0.02);
          gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + start + duration);
          
          osc.start(audioCtx.currentTime + start);
          osc.stop(audioCtx.currentTime + start + duration);
        };

        for(let i = 0; i < 6; i++) {
          const freq = i % 2 === 0 ? 987.77 : 783.99;
          playTone(freq, i * 0.5, 0.4); 
        }
      } catch (e) {
        console.error("Audio error", e);
      }
    };

    const interval = setInterval(() => {
      const now = new Date();
      
      // Purchases Reminders
      purchases.forEach(p => {
        if (p.tulovHolati === 'tolanmadi' && p.tulovMuddati && !notifiedIds.has(p.id)) {
          const deadline = new Date(p.tulovMuddati.replace(' ', 'T'));
          if (deadline <= now && (now.getTime() - deadline.getTime()) < 3600000) {
             const vendor = kontragents.find(k => k.id === p.kontragentId)?.nomi || 'Noma\'lum';
             const message = `Xurmatli "${companyName}", siz "${vendor}" firmadan shu maxsulotlar uchun ${(p.jami || 0).toLocaleString()} so'm to'lov qilishingiz kerak.`;
             
             playSound();

             if ("Notification" in window && Notification.permission === "granted") {
               const n = new Notification("To'lov eslatmasi", { body: message, tag: p.id });
               n.onclick = () => {
                 window.focus();
                 setEditingPurchase(p);
                 setCurrentPage(Page.XaridYangi);
               };
             } else {
               alert(message);
             }
             setNotifiedIds(prev => new Set(prev).add(p.id));
          }
        }
      });

      // Sales Reminders
      sales.forEach(s => {
        if (s.holat === 'tolanmagan' && s.tolovMuddati && !notifiedIds.has(s.id)) {
          const deadline = new Date(s.tolovMuddati);
          // Check if date is today or passed
          if (deadline <= now && (now.getTime() - deadline.getTime()) < 86400000) {
             const customer = kontragents.find(k => k.id === s.kontragentId)?.nomi || 'Noma\'lum';
             const message = `Xaridor "${customer}" dan ${(s.jami || 0).toLocaleString()} so'm to'lov muddati keldi.`;
             
             playSound();

             if ("Notification" in window && Notification.permission === "granted") {
               const n = new Notification("Xaridor to'lovi", { body: message, tag: s.id });
               n.onclick = () => {
                 window.focus();
                 setEditingSale(s);
                 setCurrentPage(Page.SotuvYangi);
               };
             } else {
               alert(message);
             }
             setNotifiedIds(prev => new Set(prev).add(s.id));
          }
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isLogged, purchases, sales, kontragents, companyName, notifiedIds]);

  const [logoClicks, setLogoClicks] = useState(0);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isPromptingAdmin, setIsPromptingAdmin] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  // Admin panel uchun so'rovlarni kuzatish
  useEffect(() => {
    if (isAdminView) {
      const unsub = onSnapshot(collection(db, 'access_control'), (snapshot) => {
        const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setRequests(reqs.sort((a: any, b: any) => ((b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))));
      }, (err) => handleFirestoreError(err, OperationType.GET, 'access_control'));
      return () => unsub();
    }
  }, [isAdminView]);

  const handleApprove = async (companyId: string) => {
    try {
      await setDoc(doc(db, 'access_control', companyId), {
        status: 'approved',
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Approve error:", e);
    }
  };

  const handleDelete = async (companyId: string) => {
    try {
      await deleteDoc(doc(db, 'access_control', companyId));
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setIsPromptingAdmin(true);
        return 0;
      }
      return next;
    });
  };

  if (!isLogged) {
    if (isAdminView) {
      return (
        <div className="min-h-screen bg-slate-900 p-4 font-sans text-white flex items-center justify-center">
          <div className="max-w-2xl w-full space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="text-blue-500" /> ADMIN PANELI
              </h1>
              <button 
                onClick={() => setIsAdminView(false)} 
                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded transition-colors"
              >
                Chiqish
              </button>
            </div>

            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-2xl">
              <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-widest">Kirish so'rovlari</h2>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {requests.length === 0 && <p className="text-center text-slate-500 py-8 italic">Hozircha so'rovlar yo'q</p>}
                {requests.map(req => (
                  <div key={req.id} className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all">
                    <div className="pr-4">
                      <p className="font-bold text-slate-200">{req.company}</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">🔑 {req.passwordHint || 'Nomalum'}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full ${req.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {req.status}
                        </span>
                        {req.updatedAt && <span className="text-[9px] text-slate-600 italic">Yangilandi: {new Date(req.updatedAt.seconds * 1000).toLocaleTimeString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {req.status !== 'approved' && (
                        <button 
                          onClick={() => handleApprove(req.id)}
                          className="p-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95"
                          title="Ruxsat berish"
                        >
                          <Check size={18} strokeWidth={3} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(req.id)}
                        className="p-2.5 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-xl transition-all active:scale-95"
                        title="O'chirish"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-slate-600 text-[10px] uppercase font-bold tracking-tighter">Boshqaruv Tizimi v1.0</p>
          </div>
        </div>
      );
    }
    return (
      <LoginScreen 
        onLogin={handleLogin} 
        onLogoClick={handleLogoClick} 
        isPromptingAdmin={isPromptingAdmin}
        setIsPromptingAdmin={setIsPromptingAdmin}
        setIsAdminView={setIsAdminView}
      />
    );
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden relative">
      {/* Sidebar Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        current={currentPage} 
        onNav={(p: Page) => { 
          if (p === Page.Hisobot) setActiveReportTab('moliya');
          setCurrentPage(p); 
          setIsSidebarOpen(false); 
        }} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 bg-white border-b border-border flex items-center justify-between px-3 md:px-6 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-1.5 hover:bg-gray-100 rounded-md md:hidden"
            >
              <Menu size={20} className="text-gray-600" />
            </button>
            <h1 className="text-xs md:text-lg font-bold uppercase tracking-tight text-gray-800 truncate">
              {getPageTitle(currentPage)}
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
             <div className="flex items-center gap-1.5 md:gap-2 bg-gray-50 py-1 pl-1 pr-2 md:pr-4 rounded-full border border-border">
                <div className="w-6 h-6 md:w-8 md:h-8 bg-brand text-white rounded-full flex items-center justify-center font-bold text-[10px] md:text-sm uppercase ring-2 ring-white">
                  {companyName.charAt(0)}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-[10px] font-bold text-gray-800 leading-none uppercase">{companyName}</span>
                </div>
                <span className="sm:hidden text-[9px] font-bold text-gray-700 whitespace-nowrap uppercase">{companyName}</span>
             </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-3 lg:p-6 pb-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>

      {/* Modals and Overlays could go here */}
    </div>
  );

  function getPageTitle(page: Page) {
    switch (page) {
      case Page.Home: return 'Bosh sahifa';
      case Page.Sotuv: return 'Sotuvlar ro\'yxati';
      case Page.SotuvYangi: return 'Yangi Sotuv';
      case Page.Xarid: return 'Xaridlar ro\'yxati';
      case Page.Kassa: return 'Kassa bo\'limi';
      case Page.Xarajatlar: return 'Xarajatlar';
      case Page.Hisobot: return 'Hisobotlar';
      case Page.MaLumotlar: return 'Ma\'lumotlar';
      default: return 'Tizim';
    }
  }

  function renderPage() {
    switch (currentPage) {
      case Page.Home: return (
        <HomePage 
          products={productsWithBalances} 
          kontragents={kontragents} 
          sales={sales} 
          purchases={purchases}
          kassa={kassa}
          onNav={(page: Page, filter?: string) => {
            if (filter === 'qarzdorlar' || filter === 'haqdorler') {
              setActiveReportTab(filter);
            } else if (filter) {
              setSalesFilter(filter);
            } else if (page === Page.Sotuv) {
              setSalesFilter('Barchasi');
            }
            setCurrentPage(page);
          }} 
          onReportTab={(tab: any) => { setActiveReportTab(tab); setCurrentPage(Page.Hisobot); }}
        />
      );
      case Page.Sotuv: return (
        <SalesList 
          sales={sales} 
          kontragents={kontragents} 
          initialFilter={salesFilter}
          onAdd={() => { setEditingSale(null); setCurrentPage(Page.SotuvYangi); }}
          onEdit={(id: string) => {
            const sale = sales.find(s => s.id === id);
            if (sale) { setEditingSale(sale); setCurrentPage(Page.SotuvYangi); }
          }}
          onDelete={async (id: string) => {
            if (window.confirm("Hujjatni o'chirishni tasdiqlaysizmi?")) {
              await fbDelete('sales', id);
            }
          }}
        />
      );
      case Page.SotuvYangi: return (
        <SalesForm 
          initial={editingSale} 
          products={productsWithBalances} 
          kontragents={kontragents} 
          purchases={purchases}
          saleCount={sales.length}
          onSave={async (doc: SaleDoc) => {
            try {
              await fbSave('sales', doc);
              setCurrentPage(Page.Sotuv);
            } catch (err) {
              console.error("Sale save error:", err);
            }
          }}
          onCancel={() => setCurrentPage(Page.Sotuv)}
          onAddKontragent={(k: Kontragent) => fbSave('kontragents', k)}
          onAddProduct={(m: Product) => fbSave('products', m)}
        />
      );
      case Page.Xarid: return (
        <PurchaseList 
          purchases={purchases} 
          kontragents={kontragents} 
          onAdd={() => { setEditingPurchase(null); setCurrentPage(Page.XaridYangi); }}
          onEdit={(id: string) => {
            const pur = purchases.find(p => p.id === id);
            if (pur) { setEditingPurchase(pur); setCurrentPage(Page.XaridYangi); }
          }}
          onDelete={async (id: string) => {
            if (window.confirm("Hujjatni o'chirishni tasdiqlaysizmi?")) {
              await fbDelete('purchases', id);
            }
          }}
        />
      );
      case Page.XaridYangi: return (
        <PurchaseForm 
          initial={editingPurchase}
          products={productsWithBalances}
          kontragents={kontragents}
          purchaseCount={purchases.length}
          onSave={async (doc: PurchaseDoc) => {
            try {
              await fbSave('purchases', doc);
              setCurrentPage(Page.Xarid);
            } catch (err) {
              console.error("Purchase save error:", err);
            }
          }}
          onCancel={() => setCurrentPage(Page.Xarid)}
          onAddKontragent={(k: Kontragent) => fbSave('kontragents', k)}
          onAddProduct={(m: Product) => fbSave('products', m)}
        />
      );
      case Page.Kassa: return (
        <KassaPage 
          transactions={kassa}
          kontragents={kontragents}
          onSave={(t: any) => fbSave('kassa', t)}
          onDelete={(id: string) => fbDelete('kassa', id)}
        />
      );
      case Page.Xarajatlar: return (
        <ExpensesPage 
          expenses={expenses} 
          onSave={(exp: any) => fbSave('expenses', exp)} 
          onDelete={(id: string) => fbDelete('expenses', id)}
        />
      );
      case Page.Hisobot: return <Reports products={productsWithBalances} sales={sales} purchases={purchases} expenses={expenses} kassa={kassa} kontragents={kontragents} activeReportTab={activeReportTab} />;
      case Page.MaLumotlar: return (
        <SettingsPage 
          products={productsWithBalances} 
          onAddProduct={(p: Product) => fbSave('products', p)}
          onUpdateProduct={(p: Product) => fbSave('products', p)}
          onDeleteProduct={(id: string) => fbDelete('products', id)}
          kontragents={kontragents} 
          onAddKontragent={(k: Kontragent) => fbSave('kontragents', k)}
          onUpdateKontragent={(k: Kontragent) => fbSave('kontragents', k)}
          onDeleteKontragent={(id: string) => fbDelete('kontragents', id)}
        />
      );
      default: return <div>Tez orada...</div>;
    }
  }
}

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────

function LoginScreen({ 
  onLogin, 
  onLogoClick, 
  isPromptingAdmin, 
  setIsPromptingAdmin, 
  setIsAdminView 
}: { 
  onLogin: (name: string) => void, 
  onLogoClick: () => void,
  isPromptingAdmin: boolean,
  setIsPromptingAdmin: (v: boolean) => void,
  setIsAdminView: (v: boolean) => void
}) {
  const [company, setCompany] = useState('');
  const [pass, setPass] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [adminError, setAdminError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requested'>('idle');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const secret = (import.meta.env.VITE_ADMIN_PASSWORD || "12345").trim();
    if (adminPassInput.trim() === secret) {
      setIsAdminView(true);
      setIsPromptingAdmin(false);
      setAdminPassInput('');
    } else {
      setAdminError(true);
      setTimeout(() => setAdminError(false), 2000);
    }
  };

  // BOT SOZLAMALARI
  const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "8771350600:AAEByWUHeteZZ5CPHUmHvW0O2xhk4oxN6H4"; 
  const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || "";

  // Firestore orqali ruxsatni tekshirish
  const checkGlobalApproval = async (name: string) => {
    try {
      const docRef = doc(db, 'access_control', name.toUpperCase().trim().replace(/\s+/g, ' '));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().status === 'approved') {
        return true;
      }
    } catch (e) {
      console.error("Firestore check error:", e);
    }
    return false;
  };

  const sendTelegramNotification = async (name: string, p: string) => {
    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn("Telegram bot ma'lumotlari to'liq kiritilmagan (Token yoki Chat ID)!");
      return;
    }
    const text = `🚀 *YANGI KIRISH SO'ROVI*\n\n🏢 Firma: ${name}\n🔑 Parol: ${p}\n\n✅ Ruxsat berish uchun Firebase-dan statusni "approved" qiling.`;
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: text,
          parse_mode: 'Markdown'
        })
      });
    } catch (e) {
      console.error("Telegramga yuborishda xatolik:", e);
    }
  };

  // Firestore listener: status o'zgarganda darhol ochiladi
  useEffect(() => {
    if (status === 'requested' && company) {
      const unsub = onSnapshot(doc(db, 'access_control', company.toUpperCase().trim().replace(/\s+/g, ' ')), (snapshot) => {
        if (snapshot.exists() && snapshot.data().status === 'approved') {
          onLogin(company);
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'access_control_single'));
      
      return () => {
        unsub();
      };
    }
  }, [status, company, onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !pass) return;

    const cleanName = company.toUpperCase().trim().replace(/\s+/g, ' ');
    console.log("Attempting login for company:", cleanName);
    setLoading(true);
    
    try {
      // Avval Firestore-dan tekshiramiz (agar avval ruxsat berilgan bo'lsa)
      const isApproved = await checkGlobalApproval(cleanName);
      if (isApproved) {
        onLogin(company);
        setLoading(false);
        return;
      }

      // Agar yo'q bo'lsa, Firestore-da request yaratamiz
      await setDoc(doc(db, 'access_control', cleanName), {
        company: cleanName,
        passwordHint: pass, 
        status: 'pending',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });

      await sendTelegramNotification(company, pass);
      setStatus('requested');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'access_control');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 border border-gray-200">
        <div className="text-center mb-8">
           <div 
             onClick={onLogoClick}
             className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4 cursor-pointer active:scale-90 transition-transform relative group"
           >
              <LayoutDashboard size={32} className="text-brand" />
              {isPromptingAdmin && (
                <div className="absolute inset-0 bg-brand rounded-2xl flex items-center justify-center animate-pulse">
                  <ShieldCheck className="text-white" />
                </div>
              )}
           </div>
           <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">UPR</h1>
           <p className="text-gray-500 text-sm mt-1">
             {isPromptingAdmin ? "Admin parolini tasdiqlang." : "Kirish uchun so'rov qoldiring."}
           </p>
        </div>
        
        {isPromptingAdmin ? (
          <form onSubmit={handleAdminSubmit} className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            <div>
              <label className="block text-[10px] font-black text-brand uppercase mb-1 tracking-widest">Admin Parol</label>
              <input 
                autoFocus
                type="password"
                className={`input bg-blue-50 h-10 text-center font-bold tracking-[1em] ${adminError ? 'border-danger' : 'border-blue-200'}`} 
                value={adminPassInput} 
                onChange={e => setAdminPassInput(e.target.value)} 
                placeholder="••••"
              />
              {adminError && <p className="text-[10px] text-danger font-bold text-center mt-2 uppercase">Noto'g'ri parol!</p>}
            </div>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setIsPromptingAdmin(false)}
                className="btn bg-gray-100 text-gray-600 h-11 flex-1 uppercase font-bold text-xs"
              >
                Bekor qilish
              </button>
              <button 
                type="submit" 
                className="btn btn-primary h-11 flex-1 uppercase font-bold text-xs"
              >
                Kirish
              </button>
            </div>
          </form>
        ) : status === 'idle' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Firmani nomi</label>
              <input 
                className="input bg-gray-50 h-10 font-bold" 
                value={company} 
                onChange={e => setCompany(e.target.value)} 
                placeholder="Masalan: DAILY-FOOD MCHJ"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Parol</label>
              <input 
                className="input bg-gray-50 h-10" 
                type="password"
                value={pass} 
                onChange={e => setPass(e.target.value)} 
                placeholder="••••"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="btn btn-primary h-11 w-full mt-2 font-bold uppercase tracking-wider relative overflow-hidden"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  TEKSHIRILMOQDA...
                </div>
              ) : "KIRISH →"}
            </button>
            <p className="text-[10px] text-gray-400 text-center uppercase font-bold tracking-tight">
              Bir marta ruxsat berilgan firma keyin so'rovsiz kiradi.
            </p>
          </form>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
               <History size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Adminga so'rov yuborildi!</h3>
              <p className="text-sm text-gray-500 mt-2 px-6">
                Sizning ma'lumotlaringiz tekshirilmoqda. Admin ruxsat berishi bilan platforma avtomatik ochiladi.
              </p>
            </div>
            <div className="pt-4">
               <div className="w-8 h-8 border-4 border-gray-200 border-t-brand rounded-full animate-spin mx-auto" />
               <p className="text-[10px] text-gray-400 mt-3 font-bold uppercase">Ruxsat kutilmoqda...</p>
            </div>
          </div>
        )}
        
        <div className="mt-8 text-center border-t pt-6 border-gray-100">
          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">Enterprise Edition v1.0</p>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function Sidebar({ current, onNav, isOpen, setIsOpen, onLogout }: any) {
  const items = [
    { id: Page.Home, label: 'Bosh sahifa', icon: LayoutDashboard },
    { id: Page.Sotuv, label: 'Sotuv', icon: ShoppingCart },
    { id: Page.Xarid, label: 'Xarid', icon: Package },
    { id: Page.Kassa, label: 'Kassa', icon: Wallet },
    { id: Page.Xarajatlar, label: 'Xarajatlar', icon: FileText },
    { id: Page.Hisobot, label: 'Hisobot', icon: TrendingUp },
    { id: Page.MaLumotlar, label: 'Ma\'lumotlar', icon: Settings },
  ];

  return (
    <aside 
      className={`bg-sidebar text-white transition-all duration-300 flex flex-col shrink-0 z-50
        ${isOpen ? 'w-64 fixed inset-y-0 left-0 md:relative' : 'w-0 overflow-hidden md:w-20 md:relative'}`}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800 shrink-0">
        <div className={`flex items-center gap-2 ${!isOpen && 'md:hidden'}`}>
           <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
              <LayoutDashboard size={18} className="text-white" />
           </div>
           <span className="font-bold tracking-tighter text-base sm:text-xl whitespace-nowrap">
             UPR <span className="text-brand">Tizimi</span>
           </span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 hover:bg-gray-800 rounded-md hidden md:block">
          {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-800 rounded-md md:hidden">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors relative group
              ${current === item.id ? 'bg-brand text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <item.icon size={20} className="shrink-0" />
            {isOpen && <span className="font-medium">{item.label}</span>}
            {!isOpen && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                {item.label}
              </div>
            )}
            {item.id === current && (
              <motion.div layoutId="activeNav" className="absolute inset-y-1 left-0 w-1 bg-white rounded-r-full" />
            )}
          </button>
        ))}
      </nav>

      <div className="p-2 border-t border-gray-800">
        <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 text-danger hover:bg-red-500/10 rounded-lg transition-colors">
          <LogOut size={20} className="shrink-0" />
          {isOpen && <span className="font-medium">Chiqish</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── HOME PAGE ───────────────────────────────────────────────────────────────

function HomePage({ products, kontragents, sales, purchases, kassa, onNav, onReportTab }: { products: Product[], kontragents: Kontragent[], sales: SaleDoc[], purchases: PurchaseDoc[], kassa: any[], onNav: any, onReportTab: any }) {
  const totalSalesCount = sales.length;
  const totalSalesSum = sales.reduce((a, s) => a + Number(s.jami || 0), 0);

  const totalPurchasesCount = purchases.length;
  const totalPurchasesSum = purchases.reduce((a, p) => a + Number(p.jami || 0), 0);

  // Consolidated balances: 
  // (+) Sales + Chiqim (money we gave them)
  // (-) Purchases + Kirim (money they gave us)
  // balance > 0 => They owe us (Qarzdorlar)
  // balance < 0 => We owe them (Haqdorlar)
  const { haqdorSum, haqdorCount, qarzdorSum, qarzdorCount } = useMemo(() => {
    let hSum = 0, hCount = 0;
    let qSum = 0, qCount = 0;
    
    kontragents.forEach(k => {
      const kSales = sales.filter(s => s.kontragentId === k.id);
      const kPurchases = purchases.filter(p => p.kontragentId === k.id);
      const kKirim = kassa.filter(t => t.kontragentId === k.id && t.tur === 'kirim');
      const kChiqim = kassa.filter(t => t.kontragentId === k.id && t.tur === 'chiqim');

      const bal = (kSales.reduce((a, s) => a + Number(s.jami || 0), 0) + kChiqim.reduce((a, t) => a + Number(t.summa || 0), 0)) - 
                  (kPurchases.reduce((a, p) => a + Number(p.jami || 0), 0) + kKirim.reduce((a, t) => a + Number(t.summa || 0), 0));

      const hasActivity = kSales.length > 0 || kPurchases.length > 0;

      if (Math.abs(bal) > 100 && hasActivity) {
        if (bal > 100) { 
          qSum += bal;
          qCount++;
        } else if (bal < -100) {
          hSum += Math.abs(bal);
          hCount++;
        }
      }
    });

    return { haqdorSum: hSum, haqdorCount: hCount, qarzdorSum: qSum, qarzdorCount: qCount };
  }, [sales, purchases, kassa, kontragents]);

  const stats = [
    { label: 'Sotuvlar', val: totalSalesCount, sum: totalSalesSum, color: 'text-brand', icon: ShoppingCart, target: Page.Sotuv, filter: 'Barchasi', sub: ' dona hujjat' },
    { label: 'Xaridlar', val: totalPurchasesCount, sum: totalPurchasesSum, color: 'text-orange-500', icon: Package, target: Page.Xarid, sub: ' dona hujjat' },
    { label: 'Qarzdorlik', val: qarzdorCount, sum: qarzdorSum, color: 'text-brand', icon: History, target: Page.Hisobot, filter: 'qarzdorlar', sub: ' ta kontragent' },
    { label: 'Haqdorlik', val: haqdorCount, sum: haqdorSum, color: 'text-danger', icon: Wallet, target: Page.Hisobot, filter: 'haqdorler', sub: ' ta kontragent' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(s => (
          <div 
            key={s.label} 
            className="card p-6 flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all group scale-100 hover:scale-[1.02] border-brand/5 hover:border-brand/20 shadow-sm"
            onClick={() => onNav(s.target, s.filter)}
          >
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">{s.label}</p>
                  <h3 className={`text-3xl font-bold font-mono tracking-tighter ${s.color}`}>
                    {s.val}
                    <span className="text-[10px] ml-1 font-sans text-gray-400 font-bold uppercase tracking-normal">{s.sub}</span>
                  </h3>
               </div>
               <div className={`p-3 rounded-xl bg-gray-50 border border-border/50 transition-colors group-hover:bg-brand/10 ${s.color}`}>
                  <s.icon size={24} />
               </div>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
               <span className={`font-bold text-lg font-mono ${s.color}`}>
                 {fmtSum(s.sum)}
               </span>
               <div className="p-2 rounded-full bg-gray-50 text-gray-300 group-hover:bg-brand/10 group-hover:text-brand transition-all">
                  <ChevronRight size={20} />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getKName(id: string, list: Kontragent[]) {
  return list.find(k => k.id === id)?.nomi || id || '—';
}

function StatusBadge({ status }: { status: DocStatus }) {
  switch (status) {
    case 'qisman': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-700">Qisman to'langan</span>;
    case 'toliq': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">To'langan</span>;
    default: return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700">To'lanmagan</span>;
  }
}

// ─── SALES LIST ──────────────────────────────────────────────────────────────

function SalesList({ sales, kontragents, initialFilter, onAdd, onEdit, onDelete }: any) {
  const [q, setQ] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [st, setSt] = useState<string>(initialFilter || 'Barchasi');

  useEffect(() => {
    if (initialFilter) {
      setSt(initialFilter);
      if (initialFilter !== 'Barchasi') setIsFilterOpen(true);
    }
  }, [initialFilter]);
  const [df, setDf] = useState('');
  const [dt, setDt] = useState('');
  const [sortBy, setSortBy] = useState<'sana' | 'raqam'>('sana');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'sana' | 'raqam') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const cleanRaqam = (r: string) => {
    const match = r.match(/^[sS](\d+)$/);
    if (match) return parseInt(match[1]).toString();
    return r;
  };

  const formatDate = (s: string) => {
    if (!s) return '—';
    const parts = s.split(' ');
    const dateParts = parts[0].split('-');
    if (dateParts.length === 3) {
      return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    }
    return s.substring(0, 10);
  };

  const filtered = useMemo(() => {
    let result = sales.filter((s: SaleDoc) => {
      const matchQ = s.raqam.toLowerCase().includes(q.toLowerCase()) || 
                     getKName(s.kontragentId, kontragents).toLowerCase().includes(q.toLowerCase());
      const matchSt = st === 'Barchasi' ? true : 
                      st === 'qarzdorlar' ? s.holat !== 'toliq' : 
                      s.holat === st;
      const dateStr = (s.sana || "").substring(0, 10);
      const matchDf = !df || dateStr >= df;
      const matchDt = !dt || dateStr <= dt;
      return matchQ && matchSt && matchDf && matchDt;
    });

    result.sort((a: SaleDoc, b: SaleDoc) => {
      if (sortBy === 'raqam') {
        const numA = parseInt(a.raqam.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.raqam.replace(/\D/g, '')) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      return sortOrder === 'asc' 
        ? a.sana.localeCompare(b.sana) 
        : b.sana.localeCompare(a.sana);
    });

    return result;
  }, [sales, q, st, df, dt, sortBy, sortOrder, kontragents]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-3 md:p-4 rounded-lg border border-border shadow-sm items-end">
         <div className="lg:col-span-2">
           <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Qidirish</label>
           <div className="relative">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input value={q} onChange={e => setQ(e.target.value)} className="input pl-9 h-10" placeholder="Raqam yoki xaridor..." />
           </div>
         </div>
         <div className="grid grid-cols-2 lg:col-span-3 gap-2">
             <button 
               onClick={() => setIsFilterOpen(!isFilterOpen)}
               className={`btn h-10 gap-2 text-xs uppercase font-bold transition-all ${isFilterOpen ? 'bg-brand text-white' : 'btn-secondary'}`}
             >
               <Filter size={14} /> Filter {st !== 'Barchasi' && <span className="ml-1 w-2 h-2 rounded-full bg-accent" />}
             </button>
             <button onClick={onAdd} className="btn btn-accent h-10 gap-2 font-bold text-[10px] sm:text-xs uppercase">➕ YARATISH</button>
         </div>
      </div>

      <AnimatePresence>
        {isFilterOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-4 rounded-lg border border-border shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Holat</label>
                  <select value={st} onChange={e => setSt(e.target.value)} className="input h-9 text-xs">
                     <option value="Barchasi">Barchasi</option>
                     <option value="qarzdorlar">Barcha qarzdorlar</option>
                     <option value="tolanmagan">To'lanmagan</option>
                     <option value="toliq">To'liq to'langan</option>
                     <option value="qisman">Qisman to'langan</option>
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sanadan</label>
                  <input type="date" value={df} onChange={e => setDf(e.target.value)} className="input h-9 text-xs" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sanagacha</label>
                  <input type="date" value={dt} onChange={e => setDt(e.target.value)} className="input h-9 text-xs" />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header p-3 w-12 text-center">#</th>
                <th className="table-header p-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort('sana')}>
                   <div className="flex items-center gap-1">
                      Sana 
                      <div className="flex flex-col -gap-1 opacity-40">
                         <ChevronUp size={10} className={sortBy === 'sana' && sortOrder === 'asc' ? 'opacity-100 text-brand' : ''} />
                         <ChevronDown size={10} className={sortBy === 'sana' && sortOrder === 'desc' ? 'opacity-100 text-brand' : ''} />
                      </div>
                   </div>
                </th>
                <th className="table-header p-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort('raqam')}>
                   <div className="flex items-center gap-1">
                      Raqam 
                      <div className="flex flex-col -gap-1 opacity-40">
                         <ChevronUp size={10} className={sortBy === 'raqam' && sortOrder === 'asc' ? 'opacity-100 text-brand' : ''} />
                         <ChevronDown size={10} className={sortBy === 'raqam' && sortOrder === 'desc' ? 'opacity-100 text-brand' : ''} />
                      </div>
                   </div>
                </th>
                <th className="table-header p-3">Xaridor</th>
                <th className="table-header p-3 text-right">Summa</th>
                <th className="table-header p-3 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s: SaleDoc, idx: number) => (
                <tr key={s.id} className="hover:bg-gray-50 group cursor-pointer select-none" onDoubleClick={() => onEdit(s.id)}>
                  <td className="p-3 text-center text-[10px] font-bold text-gray-400 border-r border-gray-50">{idx + 1}</td>
                  <td className="p-3 text-xs text-gray-500 font-medium">{formatDate(s.sana)}</td>
                  <td className="p-3 font-bold text-gray-800">{cleanRaqam(s.raqam)}</td>
                  <td className="p-3 font-medium text-blue-800">{getKName(s.kontragentId, kontragents)}</td>
                  <td className="p-3 text-right font-mono text-brand">
                    <div className="font-bold">{fmtSum(s.jami)}</div>
                    {s.holat === 'qisman' && (
                      <div className="text-[10px] text-danger font-bold">Qarz: {fmtSum(s.jami - (s.tolanganSumma || 0))}</div>
                    )}
                  </td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onEdit(s.id)} className="p-2 hover:bg-blue-50 text-blue-600 rounded">✏️</button>
                      <button onClick={() => onDelete(s.id)} className="p-2 hover:bg-red-50 text-danger rounded"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Ma'lumot topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SALES FORM ──────────────────────────────────────────────────────────────

function SalesForm({ initial, products, kontragents, purchases, saleCount, onSave, onCancel, onAddKontragent, onAddProduct }: any) {
  const calculateWAC = (productId: string, date: string) => {
    if (!productId) return 0;
    const relevantPurchases = purchases.filter((p: any) => (p.sana || "").substring(0, 10) <= date.substring(0, 10));
    let totalQty = 0;
    let totalCost = 0;
    relevantPurchases.forEach((p: any) => {
      (p.rows || []).forEach((r: any) => {
        if (r.productId === productId) {
          totalQty += Number(r.miqdor || 0);
          totalCost += Number(r.miqdor || 0) * Number(r.narx || 0);
        }
      });
    });
    if (totalQty <= 0) return 0;
    return totalCost / totalQty;
  };

  const [formData, setFormData] = useState<SaleDoc>(initial || {
    id: 's' + Date.now(),
    raqam: (saleCount + 1).toString(),
    sana: new Date().toISOString().slice(0, 10),
    kontragentId: '',
    holat: 'tolanmagan',
    ombor: 'asosiy',
    rows: [],
    summa: 0,
    jami: 0
  });

  const updateDate = (newDate: string) => {
    const newRows = (formData.rows || []).map(r => ({
      ...r,
      xaridNarxi: calculateWAC(r.productId, newDate)
    }));
    setFormData({ ...formData, sana: newDate, rows: newRows, ...updateTotals(newRows) });
  };



  const [isKModalOpen, setIsKModalOpen] = useState(false);
  const [isMModalOpen, setIsMModalOpen] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const updateTotals = (rows: DocRow[]) => {
    const summa = rows.reduce((a, r) => a + (r.miqdor * r.narx), 0);
    const jami = summa;
    const updates: any = { summa, jami };
    if (formData.holat === 'toliq') {
      updates.tolanganSumma = jami;
    } else if (formData.holat === 'tolanmagan') {
      updates.tolanganSumma = 0;
    }
    return updates;
  };

  const addRow = () => {
    const newRows = [...(formData.rows || []), { id: 'r'+Date.now(), productId: '', miqdor: 1, narx: 0, xaridNarxi: 0 }];
    setFormData({ ...formData, rows: newRows, ...updateTotals(newRows) });
  };

  const removeRow = (id: string) => {
    const newRows = (formData.rows || []).filter(r => r.id !== id);
    setFormData({ ...formData, rows: newRows, ...updateTotals(newRows) });
  };

  const updateRow = (id: string, field: keyof DocRow, val: any) => {
    const newRows = (formData.rows || []).map(r => {
      if (r.id === id) {
        const nr = { ...r, [field]: val };
        if (field === 'productId') {
          nr.xaridNarxi = calculateWAC(val, formData.sana);
        }
        return nr;
      }
      return r;
    });
    setFormData({ ...formData, rows: newRows, ...updateTotals(newRows) });
  };

  const handleShare = () => {
    const kName = kontragents.find((k: any) => k.id === formData.kontragentId)?.nomi || 'Nomaʼlum';
    const debt = formData.jami - (formData.tolanganSumma || 0);
    const text = `
🛒 Hujjat: ${formData.raqam}
📅 Sana: ${formData.sana}
👤 Mijoz: ${kName}
💰 Jami: ${fmtSum(formData.jami)}
💵 To'langan: ${fmtSum(formData.tolanganSumma || 0)}
📉 Qarz: ${fmtSum(debt)}
    `.trim();

    if (navigator.share) {
      navigator.share({
        title: `Sotuv ${formData.raqam}`,
        text: text,
      }).catch(console.error);
    } else {
      const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER TOOLS */}
      <div className="bg-white border border-border rounded-lg p-3 flex flex-wrap gap-2 items-center shadow-sm print:hidden">
         <button onClick={() => onSave(formData)} className="btn btn-accent gap-2 h-9 text-xs uppercase font-bold">✅ Tasdiqlash</button>
         <button onClick={() => onSave(formData)} className="btn btn-secondary gap-2 h-9 text-xs uppercase font-bold">💾 Saqlash</button>
         <div className="w-[1px] h-6 bg-gray-200 mx-1 sm:mx-2" />
         <button onClick={() => window.print()} className="btn btn-secondary gap-2 h-9 text-xs uppercase font-bold hidden sm:flex"><Printer size={16} /> Chop etish</button>
         <button onClick={handleShare} className="btn btn-secondary gap-2 h-9 text-xs uppercase font-bold text-blue-600"><Share2 size={16} /> Uzatish</button>
         <button onClick={onCancel} className="btn btn-secondary h-9 ml-auto text-xs uppercase font-bold">Bekor</button>
      </div>

      {/* FORM FIELDS */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Hujjat raqami</label>
            <input value={formData.raqam} readOnly className="input bg-gray-50 border-dashed" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sana</label>
            <input 
              type="date" 
              value={formData.sana} 
              onChange={e => updateDate(e.target.value)} 
              className="input" 
            />
          </div>
          <div className="lg:col-span-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Xaridor</label>
             <div className="flex gap-1">
               <select 
                 className="input flex-1" 
                 value={formData.kontragentId} 
                 onChange={e => setFormData({ ...formData, kontragentId: e.target.value })}
                >
                  <option value="">— Tanlang —</option>
                  {kontragents.filter((k: any) => k.tur === 'xaridor').map((k: any) => (
                    <option key={k.id} value={k.id}>{k.nomi}</option>
                  ))}
               </select>
               <button onClick={() => setIsKModalOpen(true)} className="btn btn-secondary shrink-0 px-3">➕</button>
             </div>
          </div>
          <div></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mt-6">
           <div className="lg:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Izoh</label>
              <input value={formData.izoh || ''} onChange={e => setFormData({ ...formData, izoh: e.target.value })} className="input" placeholder="Ixtiyoriy izoh..." />
           </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="card">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
           <h4 className="font-bold text-sm text-gray-700">Tovarlar va xizmatlar</h4>
           <button onClick={addRow} className="btn btn-secondary btn-sm h-8 py-0 gap-2"><Plus size={14} /> Qo'shish</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
               <tr>
                 <th className="table-header p-3 w-10 text-center">#</th>
                 <th className="table-header p-3 min-w-[150px]">Nomenklatura</th>
                 <th className="table-header p-3 w-32">Miqdor</th>
                 <th className="table-header p-3 w-32">Xarid Narxi</th>
                 <th className="table-header p-3 w-32">Sotish Narxi</th>
                 <th className="table-header p-3 text-right">Summa</th>
                 <th className="table-header p-3 w-10"></th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {formData.rows.map((r, i) => {
                 const p = products.find((x: any) => x.id === r.productId);
                 return (
                   <tr key={r.id}>
                     <td className="p-3 text-center text-xs text-gray-400">{i + 1}</td>
                     <td className="p-2">
                        <div className="flex gap-1">
                          <select className="input flex-1 h-10 font-bold" value={r.productId} onChange={e => updateRow(r.id, 'productId', e.target.value)}>
                            <option value="">— Maxsulot —</option>
                            {products.map((p: any) => <option key={p.id} value={p.id}>{p.nomi}</option>)}
                          </select>
                          <button onClick={() => { setActiveRowId(r.id); setIsMModalOpen(true); }} className="btn btn-secondary shrink-0 px-3 h-10">➕</button>
                        </div>
                     </td>
                     <td className="p-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              className="input border-transparent hover:border-gray-300 focus:bg-gray-50 text-right font-mono"
                              value={r.miqdor}
                              onChange={e => updateRow(r.id, 'miqdor', parseFloat(e.target.value) || 0)}
                            />
                            <span className="text-[10px] font-bold text-gray-400 uppercase w-6">{p?.olchov || '..'}</span>
                          </div>
                          {p && (
                            <div className={`text-[10px] font-bold px-1 rounded ${
                                (p.qoldiq - r.miqdor) > 0 ? 'text-success' : 
                                (p.qoldiq - r.miqdor) === 0 ? 'text-warning bg-amber-50' : 
                                'text-danger bg-red-50'
                              }`}>
                              { (p.qoldiq - r.miqdor) > 0 ? `${fmt(p.qoldiq - r.miqdor)} ${p.olchov} qoldi` : 
                                (p.qoldiq - r.miqdor) === 0 ? 'Maxsulot qolmadi' : 
                                `${fmt(Math.abs(p.qoldiq - r.miqdor))} ${p.olchov} yetmayabdi` }
                            </div>
                          )}
                        </div>
                     </td>
                     <td className="p-2 text-right">
                        <span className="font-mono text-gray-500 text-sm">{fmtSum(r.xaridNarxi || 0)}</span>
                     </td>
                     <td className="p-2">
                        <input 
                          type="text" 
                          inputMode="numeric"
                          className="input border-transparent hover:border-gray-300 focus:bg-gray-50 text-right font-mono text-brand font-bold"
                          value={fmtInput(r.narx)}
                          onChange={e => updateRow(r.id, 'narx', parseSum(e.target.value))}
                        />
                     </td>
                     <td className="p-3 text-right font-mono font-bold text-gray-700">
                        {fmtSum(r.miqdor * r.narx)}
                     </td>
                     <td className="p-2 text-center">
                        <button onClick={() => removeRow(r.id)} className="p-2 hover:bg-red-50 text-danger rounded"><Trash2 size={16} /></button>
                     </td>
                   </tr>
                 );
               })}
               {formData.rows.length === 0 && (
                 <tr>
                   <td colSpan={7} className="p-8 text-center text-gray-400 italic">Jadval bo'sh. <button onClick={addRow} className="text-brand font-bold underline">Qator qo'shing</button></td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>

        {/* TOTALS BAR */}
        <div className="p-6 bg-gray-50 border-t flex flex-col items-end gap-2">
           <div className="flex items-center gap-10 mt-2">
              <span className="font-bold text-gray-800 uppercase text-xs">Jami summa:</span>
              <span className="text-2xl font-bold font-mono text-brand">{fmtSum(formData.jami)}</span>
           </div>
        </div>
      </div>

      {isKModalOpen && (
        <KontragentModal 
          onSave={(k: any) => { onAddKontragent(k); setIsKModalOpen(false); setFormData({ ...formData, kontragentId: k.id }); }} 
          onClose={() => setIsKModalOpen(false)} 
        />
      )}

      {isMModalOpen && (
        <MahsulotModal
          onSave={(m: any) => { 
            onAddProduct(m); 
            setIsMModalOpen(false); 
            if (activeRowId) updateRow(activeRowId, 'productId', m.id);
            setActiveRowId(null);
          }}
          onClose={() => { setIsMModalOpen(false); setActiveRowId(null); }}
        />
      )}
    </div>
  );
}

function KontragentModal({ onSave, onClose }: any) {
  const [nomi, setNomi] = useState('');
  const [tel, setTel] = useState('');
  const [tel2, setTel2] = useState('');

  const formatPhoneInput = (val: string) => {
    let x = val.replace(/\D/g, '').match(/(\d{0,3})(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!x) return val;
    if (!x[1]) return "";
    let res = (x[1] === '998' ? '+' : '') + x[1];
    if (x[2]) res += ' ' + x[2];
    if (x[3]) res += ' ' + x[3];
    if (x[4]) res += '-' + x[4];
    if (x[5]) res += '-' + x[5];
    return res;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
       <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
          <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
             <h3 className="font-bold">Yangi Xaridor</h3>
             <button onClick={onClose}><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
             <div>
               <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Nomi</label>
               <input value={nomi} onChange={e => setNomi(e.target.value)} className="input" placeholder="Tashkilot nomi" />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Telefon 1</label>
                 <input 
                    value={tel} 
                    onChange={e => setTel(formatPhoneInput(e.target.value))} 
                    className="input font-mono font-bold text-blue-700" 
                    placeholder="+998 90 123-45-67" 
                 />
               </div>
               <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Telefon 2</label>
                 <input 
                    value={tel2} 
                    onChange={e => setTel2(formatPhoneInput(e.target.value))} 
                    className="input font-mono font-bold text-blue-700" 
                    placeholder="+998 90 123-45-67" 
                 />
               </div>
             </div>
          </div>
          <div className="p-4 bg-gray-50 border-t flex gap-2 justify-end">
             <button onClick={onClose} className="btn btn-secondary">Bekor qilish</button>
             <button onClick={() => onSave({ id: 'k' + Date.now(), nomi, tel, tel2, tur: 'xaridor' })} className="btn btn-primary px-8">Saqlash</button>
          </div>
       </div>
    </div>
  );
}

// ─── PURCHASE LIST ────────────────────────────────────────────────────────────

function PurchaseList({ purchases, kontragents, onAdd, onEdit, onDelete }: any) {
  const [q, setQ] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [df, setDf] = useState('');
  const [dt, setDt] = useState('');
  const [sortBy, setSortBy] = useState<'sana' | 'raqam'>('sana');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'sana' | 'raqam') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const cleanRaqam = (r: string) => {
    const match = r.match(/^[xpXP](\d+)$/); // P for purchase usually
    if (match) return parseInt(match[1]).toString();
    // Sometimes it's S for everything in this template, let's check
    const matchAny = r.match(/^[a-zA-Z](\d+)$/);
    if (matchAny) return parseInt(matchAny[1]).toString();
    return r;
  };

  const formatDate = (s: string) => {
    if (!s) return '—';
    const parts = s.split(' ');
    const dateParts = parts[0].split('-');
    if (dateParts.length === 3) {
      return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    }
    return s.substring(0, 10);
  };

  const filtered = useMemo(() => {
    let result = purchases.filter((p: PurchaseDoc) => {
      const matchQ = p.raqam.toLowerCase().includes(q.toLowerCase()) || 
                     getKName(p.kontragentId, kontragents).toLowerCase().includes(q.toLowerCase());
      const dateStr = (p.sana || "").substring(0, 10);
      const matchDf = !df || dateStr >= df;
      const matchDt = !dt || dateStr <= dt;
      return matchQ && matchDf && matchDt;
    });

    result.sort((a: PurchaseDoc, b: PurchaseDoc) => {
      if (sortBy === 'raqam') {
        const numA = parseInt(a.raqam.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.raqam.replace(/\D/g, '')) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      return sortOrder === 'asc' 
        ? a.sana.localeCompare(b.sana) 
        : b.sana.localeCompare(a.sana);
    });

    return result;
  }, [purchases, q, df, dt, sortBy, sortOrder, kontragents]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-3 md:p-4 rounded-lg border border-border shadow-sm items-end">
         <div className="lg:col-span-3">
           <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Qidirish</label>
           <div className="relative">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input value={q} onChange={e => setQ(e.target.value)} className="input pl-9 h-10" placeholder="Raqam yoki yetkazib beruvchi..." />
           </div>
         </div>
         <div className="grid grid-cols-2 lg:col-span-2 gap-2">
             <button 
               onClick={() => setIsFilterOpen(!isFilterOpen)}
               className={`btn h-10 gap-2 text-xs uppercase font-bold transition-all ${isFilterOpen ? 'bg-brand text-white' : 'btn-secondary'}`}
             >
               <Filter size={14} /> Filter
             </button>
             <button onClick={onAdd} className="btn btn-accent h-10 w-full gap-2 font-bold text-[10px] sm:text-xs uppercase">📥 YANGI XARID</button>
         </div>
      </div>

      <AnimatePresence>
        {isFilterOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-4 rounded-lg border border-border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sanadan</label>
                  <input type="date" value={df} onChange={e => setDf(e.target.value)} className="input h-9 text-xs" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sanagacha</label>
                  <input type="date" value={dt} onChange={e => setDt(e.target.value)} className="input h-9 text-xs" />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="table-header p-3 w-12 text-center text-gray-400">#</th>
                <th className="table-header p-3 text-left cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort('sana')}>
                   <div className="flex items-center gap-1">
                      Sana 
                      <div className="flex flex-col -gap-1 opacity-40">
                         <ChevronUp size={10} className={sortBy === 'sana' && sortOrder === 'asc' ? 'opacity-100 text-brand' : ''} />
                         <ChevronDown size={10} className={sortBy === 'sana' && sortOrder === 'desc' ? 'opacity-100 text-brand' : ''} />
                      </div>
                   </div>
                </th>
                <th className="table-header p-3 text-left cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort('raqam')}>
                   <div className="flex items-center gap-1">
                      Raqam 
                      <div className="flex flex-col -gap-1 opacity-40">
                         <ChevronUp size={10} className={sortBy === 'raqam' && sortOrder === 'asc' ? 'opacity-100 text-brand' : ''} />
                         <ChevronDown size={10} className={sortBy === 'raqam' && sortOrder === 'desc' ? 'opacity-100 text-brand' : ''} />
                      </div>
                   </div>
                </th>
                <th className="table-header p-3 text-left">Yetkazib beruvchi</th>
                <th className="table-header p-3 text-right">Summa</th>
                <th className="table-header p-3 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p: PurchaseDoc, idx: number) => (
                <tr key={p.id} className="hover:bg-gray-50 group cursor-pointer" onClick={() => onEdit(p.id)}>
                  <td className="p-3 text-center text-[10px] font-bold text-gray-400 border-r border-gray-50">{idx + 1}</td>
                  <td className="p-3 text-xs text-gray-500 font-medium">{formatDate(p.sana)}</td>
                  <td className="p-3 font-bold text-gray-800">{cleanRaqam(p.raqam)}</td>
                  <td className="p-3 font-medium text-blue-800">
                    <div className="flex items-center gap-2">
                       {getKName(p.kontragentId, kontragents)}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-orange-600">{fmtSum(p.jami)}</td>
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onEdit(p.id)} className="p-2 hover:bg-blue-50 text-blue-600 rounded">✏️</button>
                      <button onClick={() => onDelete(p.id)} className="p-2 hover:bg-red-50 text-danger rounded"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Xaridlar mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PURCHASE FORM ────────────────────────────────────────────────────────────

function PurchaseForm({ initial, products, kontragents, purchaseCount, onSave, onCancel, onAddKontragent, onAddProduct }: any) {
  const [formData, setFormData] = useState<PurchaseDoc>(initial || {
    id: 'p' + Date.now(),
    raqam: (purchaseCount + 1).toString(),
    sana: new Date().toISOString().slice(0, 16).replace('T', ' '),
    kontragentId: '',
    holat: 'toliq',
    ombor: 'asosiy',
    rows: [],
    summa: 0,
    jami: 0,
    tulovHolati: 'tolanmadi',
    tulovMuddati: ''
  });

  const [isKModalOpen, setIsKModalOpen] = useState(false);
  const [isMModalOpen, setIsMModalOpen] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const updateTotals = (rows: DocRow[]) => {
    const suma = rows.reduce((a, r) => a + (r.miqdor * r.narx), 0);
    return { summa: suma, jami: suma };
  };

  const addRow = () => {
    const newRows = [...(formData.rows || []), { id: 'r'+Date.now(), productId: '', miqdor: 1, narx: 0 }];
    setFormData({ ...formData, rows: newRows, ...updateTotals(newRows) });
  };

  const removeRow = (id: string) => {
    const newRows = (formData.rows || []).filter(r => r.id !== id);
    setFormData({ ...formData, rows: newRows, ...updateTotals(newRows) });
  };

  const updateRow = (id: string, field: keyof DocRow, val: any) => {
    const newRows = (formData.rows || []).map(r => {
      if (r.id === id) {
         const nr = { ...r, [field]: val };
         if (field === 'productId') {
            // Do not auto-fill price as it was removed from product management
         }
         return nr;
      }
      return r;
    });
    setFormData({ ...formData, rows: newRows, ...updateTotals(newRows) });
  };

  const handleShare = () => {
    const kName = kontragents.find((k: any) => k.id === formData.kontragentId)?.nomi || 'Nomaʼlum';
    const text = `
📦 Xarid: ${formData.raqam}
📅 Sana: ${formData.sana}
👤 Ta'minotchi: ${kName}
💰 Jami: ${fmtSum(formData.summa)}
    `.trim();

    if (navigator.share) {
      navigator.share({
        title: `Xarid ${formData.raqam}`,
        text: text,
      }).catch(console.error);
    } else {
      const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-lg p-3 flex flex-wrap gap-2 items-center shadow-sm print:hidden">
         <button onClick={() => onSave(formData)} className="btn bg-orange-500 text-white gap-2 h-9 hover:bg-orange-600 font-bold text-xs uppercase">📥 Qabul qilish</button>
         <button onClick={() => window.print()} className="btn btn-secondary gap-2 h-9 border-dashed text-xs font-bold uppercase hidden sm:flex"><Printer size={16} /> CHOP ETISH</button>
         <button onClick={handleShare} className="btn btn-secondary gap-2 h-9 text-xs uppercase font-bold text-blue-600"><Share2 size={16} /> Uzatish</button>
         <button onClick={onCancel} className="btn btn-secondary h-9 ml-auto text-xs font-bold uppercase">Bekor qilish</button>
      </div>

      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Raqam</label>
            <input value={formData.raqam} readOnly className="input bg-gray-50 border-dashed" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sana</label>
            <input 
              type="date" 
              value={formData.sana} 
              onChange={e => setFormData({ ...formData, sana: e.target.value })} 
              className="input" 
            />
          </div>
          <div className="lg:col-span-2">
             <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Yetkazib beruvchi</label>
             <div className="flex gap-1">
               <select 
                 className="input flex-1" 
                 value={formData.kontragentId} 
                 onChange={e => setFormData({ ...formData, kontragentId: e.target.value })}
                >
                  <option value="">— Yetkazuvchi —</option>
                  {kontragents.filter((k: any) => k.tur === 'yetkazuvchi').map((k: any) => (
                    <option key={k.id} value={k.id}>{k.nomi}</option>
                  ))}
               </select>
               <button onClick={() => setIsKModalOpen(true)} className="btn btn-secondary shrink-0 px-3">➕</button>
             </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
           <h4 className="font-bold text-sm text-gray-700">Xarid tovarlari</h4>
           <button onClick={addRow} className="btn btn-secondary btn-sm h-8 py-0 gap-2"><Plus size={14} /> Qo'shish</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
               <tr>
                 <th className="table-header p-3 w-10 text-center">#</th>
                 <th className="table-header p-3">Nomenklatura</th>
                 <th className="table-header p-3 w-32 text-right">Miqdor</th>
                 <th className="table-header p-3 w-40 text-right">Narx</th>
                 <th className="table-header p-3 text-right">Summa</th>
                 <th className="table-header p-3 w-10"></th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {formData.rows.map((r, i) => {
                 const p = products.find((x: Product) => x.id === r.productId);
                 return (
                   <tr key={r.id}>
                     <td className="p-3 text-center text-xs text-gray-400">{i + 1}</td>
                     <td className="p-2">
                        <div className="flex gap-1">
                          <select 
                            className="input flex-1 h-10 font-semibold"
                            value={r.productId}
                            onChange={e => updateRow(r.id, 'productId', e.target.value)}
                          >
                            <option value="">— Mahsulot —</option>
                            {products.map((p: any) => <option key={p.id} value={p.id}>{p.nomi}</option>)}
                          </select>
                          <button onClick={() => { setActiveRowId(r.id); setIsMModalOpen(true); }} className="btn btn-secondary shrink-0 px-3 h-10">➕</button>
                        </div>
                     </td>
                     <td className="p-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            className="input border-transparent text-right font-mono flex-1"
                            value={r.miqdor}
                            onChange={e => updateRow(r.id, 'miqdor', parseFloat(e.target.value) || 0)}
                          />
                          <span className="text-[10px] font-bold text-gray-400 uppercase w-6">{p?.olchov || '..'}</span>
                        </div>
                     </td>
                     <td className="p-2">
                        <input 
                          type="text" 
                          inputMode="numeric"
                          className="input border-transparent text-right font-mono"
                          value={fmtInput(r.narx)}
                          onChange={e => updateRow(r.id, 'narx', parseSum(e.target.value))}
                        />
                     </td>
                     <td className="p-3 text-right font-mono font-bold text-gray-700">
                        {fmtSum(r.miqdor * r.narx)}
                     </td>
                     <td className="p-2 text-center">
                        <button onClick={() => removeRow(r.id)} className="p-2 hover:bg-red-50 text-danger rounded"><Trash2 size={16} /></button>
                     </td>
                   </tr>
                 );
               })}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end">
           <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Jami xarid summasi</p>
              <h2 className="text-2xl font-bold font-mono text-orange-600">{fmtSum(formData.jami)}</h2>
           </div>
        </div>
      </div>

      {isKModalOpen && (
        <KontragentModal 
          onSave={(k: any) => { onAddKontragent(k); setIsKModalOpen(false); setFormData({ ...formData, kontragentId: k.id }); }} 
          onClose={() => setIsKModalOpen(false)} 
        />
      )}

      {isMModalOpen && (
        <MahsulotModal
          onSave={(m: any) => { 
            onAddProduct(m); 
            setIsMModalOpen(false); 
            if (activeRowId) updateRow(activeRowId, 'productId', m.id);
            setActiveRowId(null);
          }}
          onClose={() => { setIsMModalOpen(false); setActiveRowId(null); }}
        />
      )}
    </div>
  );
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────

function Reports({ products, sales, purchases, expenses, kassa, kontragents, activeReportTab }: any) {
  const [activeTab, setActiveTab] = useState<'moliya' | 'haqdorler' | 'qarzdorlar' | 'ombor'>(activeReportTab || 'moliya');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedKontragentId, setSelectedKontragentId] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ type: 'sales' | 'cogs' | 'expenses', data: any[] } | null>(null);

  useEffect(() => {
    if (activeReportTab) setActiveTab(activeReportTab);
  }, [activeReportTab]);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10).substring(0, 8) + '01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const filteredSales = sales.filter((s: SaleDoc) => {
    const d = (s.sana || "").substring(0, 10);
    return d >= dateFrom && d <= dateTo;
  });

  const filteredPurchases = purchases.filter((p: PurchaseDoc) => {
    const d = (p.sana || "").substring(0, 10);
    return d >= dateFrom && d <= dateTo;
  });

  const filteredExpenses = expenses.filter((e: any) => {
    return e.sana >= dateFrom && e.sana <= dateTo;
  });

  const handlePrint = () => {
    window.print();
  };

  const totalSale = filteredSales.reduce((a: any, s: any) => a + s.summa, 0);

  const getCOGS = (r: any, saleDate: string) => {
    // 1. Trust saved cost if present (if it's non-zero)
    if (r.xaridNarxi !== undefined && Number(r.xaridNarxi) > 0) return Number(r.xaridNarxi);

    // 2. Fallback to WAC based on ALL purchases (not just up to sale date, as dates might be messy)
    // First try up to sale date
    const upToDate = (saleDate || "").substring(0, 10);
    let relevantPurchases = purchases.filter((p: any) => (p.sana || "").substring(0, 10) <= upToDate);
    
    // If no purchases found up to that date, try ANY purchase of this product
    if (relevantPurchases.length === 0) {
      relevantPurchases = purchases; 
    }

    let totalQty = 0;
    let totalCostVal = 0;
    relevantPurchases.forEach((p: any) => {
      (p.rows || []).forEach((pr: any) => {
        if (pr.productId === r.productId) {
          totalQty += Number(pr.miqdor || 0);
          totalCostVal += Number(pr.miqdor || 0) * Number(pr.narx || 0);
        }
      });
    });

    if (totalQty > 0) return totalCostVal / totalQty;

    // 3. Last fallback: default product cost
    const p = products.find((prod: any) => prod.id === r.productId);
    return p?.xaridNarxi || 0;
  };

  const totalCost = filteredSales.reduce((a: any, s: any) => 
    a + (s.rows || []).reduce((sum: any, r: any) => sum + (Number(r.miqdor || 0) * getCOGS(r, s.sana || "")), 0), 
  0);

  const totalExp = filteredExpenses.reduce((a: any, e: any) => a + e.summa, 0);
  const netProfit = totalSale - totalCost - totalExp;

  const handleShare = () => {
    const textMap = {
      ombor: "📊 Ombor qoldiqlari hisoboti",
      haqdorler: "📊 Haqdorlar (Mijozlar qarzi) hisoboti",
      qarzdorlar: "📊 Qarzdorlik (Bizning qarzimiz) hisoboti",
      moliya: "📊 Moliya hisoboti"
    };
    const text = textMap[activeTab];
    if (navigator.share) {
      navigator.share({
        title: text,
        text: `${text}\nSana: ${new Date().toLocaleDateString('uz-UZ')}\nFilter: ${dateFrom} - ${dateTo}`,
      }).catch(console.error);
    } else {
      const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  // Consolidated balances for Reports
  const unifiedBalances = useMemo(() => {
    const list: any[] = [];
    kontragents.forEach((k: any) => {
      const kSales = sales.filter((s: any) => s.kontragentId === k.id && (s.sana || "").substring(0, 10) <= dateTo);
      const kPurchases = purchases.filter((p: any) => p.kontragentId === k.id && (p.sana || "").substring(0, 10) <= dateTo);
      const kKirim = kassa.filter((t: any) => t.kontragentId === k.id && t.tur === 'kirim' && (t.sana || "").substring(0, 10) <= dateTo);
      const kChiqim = kassa.filter((t: any) => t.kontragentId === k.id && t.tur === 'chiqim' && (t.sana || "").substring(0, 10) <= dateTo);
      
      const totalS = kSales.reduce((a: number, s: any) => a + s.jami, 0);
      const totalP = kPurchases.reduce((a: number, p: any) => a + p.jami, 0);
      const totalK = kKirim.reduce((a: number, t: any) => a + t.summa, 0);
      const totalC = kChiqim.reduce((a: number, t: any) => a + t.summa, 0);
      
      const balance = (totalS + totalC) - (totalP + totalK);

      // Faqat sotuv yoki xaridi borlarni ko'rsatamiz (foydalanuvchi iltimosiga ko'ra kassa adashmovchiliklarini filtrlash uchun)
      const hasActivity = totalS > 0 || totalP > 0;

      if (Math.abs(balance) > 100 && hasActivity) { 
        list.push({ ...k, totalS, totalP, totalK, totalC, balance });
      }
    });
    return list;
  }, [kontragents, sales, purchases, kassa, dateTo]);

  const haqdorlarData = useMemo(() => {
    return unifiedBalances.filter(b => b.balance < 0).map(b => ({ ...b, absBalance: Math.abs(b.balance) })).sort((a, b) => b.absBalance - a.absBalance);
  }, [unifiedBalances]);

  const qarzdorlarData = useMemo(() => {
    return unifiedBalances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
  }, [unifiedBalances]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 bg-white p-4 rounded-lg border border-border shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 p-1 bg-gray-200 rounded-lg w-full sm:w-auto">
            <button 
              onClick={() => setActiveTab('moliya')} 
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md font-bold text-[10px] sm:text-xs uppercase transition-all ${activeTab === 'moliya' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >Moliya</button>
            <button 
              onClick={() => setActiveTab('haqdorler')} 
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md font-bold text-[10px] sm:text-xs uppercase transition-all ${activeTab === 'haqdorler' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >Haqdorlik</button>
            <button 
              onClick={() => setActiveTab('qarzdorlar')} 
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md font-bold text-[10px] sm:text-xs uppercase transition-all ${activeTab === 'qarzdorlar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >Qarzdorlik</button>
            <button 
              onClick={() => setActiveTab('ombor')} 
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md font-bold text-[10px] sm:text-xs uppercase transition-all ${activeTab === 'ombor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >Ombor</button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={handlePrint} className="flex-1 sm:flex-none btn btn-secondary gap-2 h-9 text-[10px] sm:text-xs uppercase font-bold justify-center hidden sm:flex">
              <Printer size={16} /> Chop etish
            </button>
            <button onClick={handleShare} className="flex-1 sm:flex-none btn btn-secondary gap-2 h-9 text-[10px] sm:text-xs uppercase font-bold justify-center text-blue-600">
              <Share2 size={16} /> Uzatish
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
           <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Davr boshlanishi (Dan)</label>
              <input type="date" className="input h-10 py-0 text-sm font-medium focus:ring-brand" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
           </div>
           <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Davr yakuni (Gacha)</label>
              <input type="date" className="input h-10 py-0 text-sm font-medium focus:ring-brand" value={dateTo} onChange={e => setDateTo(e.target.value)} />
           </div>
           
           <div className="lg:col-span-2 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tezkor tanlash</label>
              <div className="flex flex-wrap gap-1.5">
                 {(() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const setRange = (from: string, to: string) => { setDateFrom(from); setDateTo(to); };
                    
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yestStr = yesterday.toISOString().slice(0, 10);
                    
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    const firstDayOfMonth = new Date();
                    firstDayOfMonth.setDate(1);
                    
                    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1);

                    const ranges = [
                       { label: 'Bugun', from: today, to: today },
                       { label: 'Kecha', from: yestStr, to: yestStr },
                       { label: '7 kun', from: weekAgo.toISOString().slice(0, 10), to: today },
                       { label: 'Oy', from: firstDayOfMonth.toISOString().slice(0, 10), to: today },
                       { label: 'Yil', from: firstDayOfYear.toISOString().slice(0, 10), to: today },
                       { label: 'Jami', from: '2024-01-01', to: today }
                    ];

                    return ranges.map(r => (
                       <button 
                          key={r.label}
                          onClick={() => setRange(r.from, r.to)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-gray-100 hover:bg-brand hover:text-white rounded transition-colors text-gray-600 border border-gray-200"
                       >
                          {r.label}
                       </button>
                    ));
                 })()}
              </div>
           </div>
        </div>
      </div>

      <div className="print:block">
      {activeTab === 'ombor' && (
          <div className="card border-none shadow-none">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between print:hidden">
              <h3 className="font-bold flex items-center gap-2 text-brand">📦 Ombor qoldiqlari ({dateFrom} - {dateTo})</h3>
            </div>
            






            <div className="p-4 hidden print:block border-b mb-4">
              <h1 className="text-xl font-bold">OMBOR QOLDIQLARI HISOBOTI</h1>
              <p className="text-sm text-gray-500">Davr: {dateFrom} dan {dateTo} gacha</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-[10px] font-bold uppercase text-gray-600">Nomenklatura</th>
                    <th className="border p-2 text-[10px] font-bold uppercase text-gray-600 text-center">Bosh. Qoldiq</th>
                    <th className="border p-2 text-[10px] font-bold uppercase text-gray-600 text-center">Kirim</th>
                    <th className="border p-2 text-[10px] font-bold uppercase text-gray-600 text-center">Chiqim</th>
                    <th className="border p-2 text-[10px] font-bold uppercase text-gray-600 text-center bg-blue-50/50">Yak. Qoldiq</th>
                    {/* Summa column removed as default prices are hidden */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p: Product) => {
                    const totalKirimBefore = purchases.filter((d: any) => (d.sana || "").substring(0, 10) < dateFrom)
                                      .reduce((a: number, d: any) => a + (d.rows || []).filter((r: any) => r.productId === p.id).reduce((sum: number, r: any) => sum + Number(r.miqdor || 0), 0), 0);
                    const totalChiqimBefore = sales.filter((d: any) => (d.sana || "").substring(0, 10) < dateFrom)
                                      .reduce((a: number, d: any) => a + (d.rows || []).filter((r: any) => r.productId === p.id).reduce((sum: number, r: any) => sum + Number(r.miqdor || 0), 0), 0);
                    
                    const beginningBalance = totalKirimBefore - totalChiqimBefore;

                    const rowKirim = purchases.filter((d: any) => (d.sana || "").substring(0, 10) >= dateFrom && (d.sana || "").substring(0, 10) <= dateTo)
                                      .reduce((a: number, d: any) => a + (d.rows || []).filter((r: any) => r.productId === p.id).reduce((sum: number, r: any) => sum + Number(r.miqdor || 0), 0), 0);
                    const rowChiqim = sales.filter((d: any) => (d.sana || "").substring(0, 10) >= dateFrom && (d.sana || "").substring(0, 10) <= dateTo)
                                      .reduce((a: number, d: any) => a + (d.rows || []).filter((r: any) => r.productId === p.id).reduce((sum: number, r: any) => sum + Number(r.miqdor || 0), 0), 0);
                    
                    const endOfPeriodBalance = beginningBalance + rowKirim - rowChiqim;
                    
                    if (beginningBalance === 0 && rowKirim === 0 && rowChiqim === 0) return null;

                    return (
                      <tr 
                        key={p.id} 
                        className="h-10 text-xs hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedProductId(p.id)}
                      >
                         <td className="border px-3 py-2 font-medium">{p.nomi}</td>
                         <td className="border px-2 py-1 text-center font-mono text-gray-600 bg-gray-50/30">{fmt(beginningBalance)} <span className="text-[9px] text-gray-400 font-bold uppercase">{p.olchov}</span></td>
                         <td className="border px-2 py-1 text-center font-mono text-green-600">{fmt(rowKirim)} <span className="text-[9px] text-gray-400 font-bold uppercase">{p.olchov}</span></td>
                         <td className="border px-2 py-1 text-center font-mono text-red-600">{fmt(rowChiqim)} <span className="text-[9px] text-gray-400 font-bold uppercase">{p.olchov}</span></td>
                         <td className="border px-2 py-1 text-center font-mono bg-blue-50/30 font-bold">{fmt(endOfPeriodBalance)} <span className="text-[9px] text-gray-400 font-bold uppercase">{p.olchov}</span></td>
                         {/* Summa cell removed */}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                    </div>
          </div>
      )}

      {activeTab === 'haqdorler' && (
        <div className="card border-none shadow-none">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between print:hidden">
            <h3 className="font-bold flex items-center gap-2 text-danger">👤 Haqdorlar (Biz qarzdor bo'lganlar)</h3>
          </div>
          <div className="p-4 hidden print:block border-b mb-4">
            <h1 className="text-xl font-bold">HAQDORLAR HISOBOTI</h1>
            <p className="text-sm text-gray-500">Sana: {dateTo} holatiga</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-[10px] font-bold uppercase text-gray-600 text-left">Kontragent nomi</th>
                  <th className="border p-2 text-[10px] font-bold uppercase text-gray-600">Telefonlar</th>
                  <th className="border p-2 text-[10px] font-bold uppercase text-gray-600 text-right">Bizdan Haqdorlik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {haqdorlarData.map((d) => (
                    <tr 
                      key={d.id} 
                      className="h-10 text-xs hover:bg-red-50 cursor-pointer transition-colors group"
                      onClick={() => setSelectedKontragentId(d.id)}
                      title="Batafsil ma'lumot ko'rish uchun bosing"
                    >
                      <td className="border px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900">{d.nomi}</span>
                          <span className="text-[9px] text-brand opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold italic">Batafsil →</span>
                        </div>
                      </td>
                      <td className="border px-3 py-2 text-gray-500">
                        <div className="flex flex-col">
                          <span className="text-xs">{d.tel || '—'}</span>
                          {d.tel2 && <span className="text-[9px] text-gray-400 font-mono italic">{d.tel2}</span>}
                        </div>
                      </td>
                      <td className="border px-3 py-2 text-right font-mono font-bold bg-red-50 text-danger border-red-100">{fmtSum(d.absBalance)}</td>
                    </tr>
                ))}
                {haqdorlarData.length === 0 && (
                  <tr><td colSpan={3} className="p-10 text-center text-gray-400 italic">Haqdorlar mavjud emas</td></tr>
                )}
              </tbody>
              {haqdorlarData.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={2} className="border px-3 py-3 text-right text-gray-500 uppercase text-[10px]">Jami bizning qarzimiz:</td>
                    <td className="border px-3 py-3 text-right font-mono text-lg text-danger">{fmtSum(haqdorlarData.reduce((a, b) => a + b.absBalance, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {activeTab === 'qarzdorlar' && (
        <div className="card border-none shadow-none">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between print:hidden">
            <h3 className="font-bold flex items-center gap-2 text-success">🤝 Qarzdorlar (Bizdan qarzdor bo'lganlar)</h3>
          </div>
          <div className="p-4 hidden print:block border-b mb-4">
            <h1 className="text-xl font-bold">QARZDORLAR HISOBOTI</h1>
            <p className="text-sm text-gray-500">Sana: {dateTo} holatiga</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-[10px] font-bold uppercase text-gray-600 text-left">Kontragent nomi</th>
                  <th className="border p-2 text-[10px] font-bold uppercase text-gray-600">Telefonlar</th>
                  <th className="border p-2 text-[10px] font-bold uppercase text-gray-600 text-right">Bizga Qarzdorlik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {qarzdorlarData.map((d) => (
                    <tr 
                      key={d.id} 
                      className="h-10 text-xs hover:bg-blue-50 cursor-pointer transition-colors group"
                      onClick={() => setSelectedKontragentId(d.id)}
                      title="Nima olgani haqida batafsil ko'rish uchun bosing"
                    >
                      <td className="border px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-900">{d.nomi}</span>
                          <span className="text-[9px] text-brand opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold italic">Batafsil →</span>
                        </div>
                      </td>
                      <td className="border px-3 py-2 text-gray-500">
                        <div className="flex flex-col">
                          <span className="text-xs">{d.tel || '—'}</span>
                          {d.tel2 && <span className="text-[9px] text-gray-400 font-mono italic">{d.tel2}</span>}
                        </div>
                      </td>
                      <td className="border px-3 py-2 text-right font-mono font-bold bg-green-50 text-success border-green-100">{fmtSum(d.balance)}</td>
                    </tr>
                ))}
                {qarzdorlarData.length === 0 && (
                  <tr><td colSpan={3} className="p-10 text-center text-gray-400 italic">Qarzdorlar mavjud emas</td></tr>
                )}
              </tbody>
              {qarzdorlarData.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={2} className="border px-3 py-3 text-right text-gray-500 uppercase text-[10px]">Jami bizning haqqimiz:</td>
                    <td className="border px-3 py-3 text-right font-mono text-lg text-success">{fmtSum(qarzdorlarData.reduce((a, b) => a + b.balance, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {activeTab === 'moliya' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="card shadow-none">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                 <h3 className="font-bold text-gray-700">📉 Moliyaviy tahlil ({dateFrom} - {dateTo})</h3>
              </div>
              <div className="p-6 space-y-4">
                  <div 
                    className="flex justify-between items-center py-3 border-b cursor-pointer hover:bg-blue-50 transition-colors group px-2 rounded"
                    onClick={() => setDetailModal({ type: 'sales', data: filteredSales })}
                  >
                     <div className="flex flex-col">
                        <span className="text-gray-500 font-medium group-hover:text-brand">Jami sotuv (Daromad):</span>
                        <span className="text-[9px] text-blue-400 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Batafsil ko'rish →</span>
                     </div>
                     <span className="font-bold text-brand font-mono text-lg">{fmtSum(totalSale)}</span>
                  </div>
                  <div 
                    className="flex justify-between items-center py-3 border-b cursor-pointer hover:bg-gray-50 transition-colors group px-2 rounded"
                    onClick={() => setDetailModal({ type: 'cogs', data: filteredSales })}
                  >
                     <div className="flex flex-col">
                        <span className="text-gray-500 font-medium group-hover:text-gray-900">Sotilgan tovarlar tannarxi:</span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Hisob-kitobni ko'rish →</span>
                     </div>
                     <span className="font-bold text-gray-700 font-mono">{fmtSum(totalCost)}</span>
                  </div>
                  <div 
                    className="flex justify-between items-center py-3 border-b cursor-pointer hover:bg-red-50 transition-colors group px-2 rounded"
                    onClick={() => setDetailModal({ type: 'expenses', data: filteredExpenses })}
                  >
                     <div className="flex flex-col">
                        <span className="text-gray-500 font-medium group-hover:text-danger">Jami xarajatlar:</span>
                        <span className="text-[9px] text-red-400 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Batafsil ko'rish →</span>
                     </div>
                     <span className="font-bold text-danger font-mono">{fmtSum(totalExp)}</span>
                  </div>
                  <div className={`flex justify-between items-center py-4 px-4 rounded-lg mt-4 ${netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <span className={`font-bold ${netProfit >= 0 ? 'text-gray-800' : 'text-red-800'}`}>
                       {netProfit >= 0 ? 'Foyda:' : 'Zarar:'}
                    </span>
                    <span className={`font-bold text-2xl font-mono ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                       {fmtSum(netProfit)}
                    </span>
                  </div>
              </div>
           </div>
        </div>
      )}
      </div>

      {/* Universal Detail Modals */}
      {detailModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-2 md:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
               <div className="p-4 border-b flex items-center justify-between bg-gray-800 text-white rounded-t-xl">
                  <h3 className="font-bold uppercase tracking-tight">
                     {detailModal.type === 'sales' ? 'Sotuvlar tafsiloti' : detailModal.type === 'cogs' ? 'Tannarx hisobi (Sotuvlar)' : 'Xarajatlar tafsiloti'}
                  </h3>
                  <button onClick={() => setDetailModal(null)} className="text-xl">&times;</button>
               </div>
               <div className="p-4 flex-1 overflow-y-auto">
                  <table className="w-full text-xs">
                     <thead>
                        <tr className="bg-gray-100 border-b">
                           <th className="p-2 text-left">Sana</th>
                           <th className="p-2 text-left">Hujjat</th>
                           <th className="p-2 text-left">Kontragent</th>
                           <th className="p-2 text-right">Summa</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {detailModal.data.map((m: any, idx: number) => (
                           <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-2">{m.sana}</td>
                              <td className="p-2 font-bold">№{m.raqam || '—'}</td>
                              <td className="p-2">{kontragents.find((k:any)=>k.id === m.kontragentId)?.nomi || '—'}</td>
                              <td className="p-2 text-right font-mono font-bold">
                                 {fmtSum(detailModal.type === 'cogs' ? (m.rows || []).reduce((sum:number, r:any) => sum + (Number(r.miqdor)*getCOGS(r, m.sana)), 0) : m.summa || m.jami)}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      )}

      {selectedKontragentId && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-6 print:static print:bg-transparent">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col print:h-auto print:shadow-none">
               <div className="p-4 border-b flex items-center justify-between bg-blue-600 text-white rounded-t-xl print:hidden">
                  <h3 className="font-bold uppercase tracking-tight flex items-center gap-2">
                     <Users size={18} />
                     {kontragents.find((k: any) => k.id === selectedKontragentId)?.nomi} - Tranzaksiyalar tarixi
                  </h3>
                  <button onClick={() => setSelectedKontragentId(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">&times;</button>
               </div>
               <div className="p-4 flex-1 overflow-y-auto space-y-6 bg-gray-50/30">
                  <div className="hidden print:block mb-8 border-b pb-4">
                     <h1 className="text-2xl font-bold uppercase">{kontragents.find((k: any) => k.id === selectedKontragentId)?.nomi}</h1>
                     <p className="text-gray-500">Batafsil hisobot: {dateFrom} - {dateTo}</p>
                  </div>

                  {(() => {
                     const k = kontragents.find((x: any) => x.id === selectedKontragentId);
                     if (!k) return null;

                     const trans: any[] = [];
                     
                     // Sales (Customer side)
                     sales.forEach((s: any) => {
                        if (s.kontragentId === selectedKontragentId) {
                           const rowItems = (s.rows || []).map((r: any) => {
                              const p = products.find((prod: any) => prod.id === r.productId);
                              return {
                                 name: p?.nomi || 'Noma\'lum',
                                 qty: r.miqdor,
                                 unit: p?.olchov || '',
                                 sum: (r.miqdor * r.narx)
                              };
                           });

                           trans.push({
                              sana: s.sana,
                              tur: 'sotuv',
                              raqam: s.raqam,
                              jami: s.jami,
                              items: rowItems,
                              izoh: s.izoh
                           });
                        }
                     });

                     // Purchases (Vendor side)
                     purchases.forEach((p: any) => {
                        if (p.kontragentId === selectedKontragentId) {
                           const rowItems = (p.rows || []).map((r: any) => {
                              const prod = products.find((prod: any) => prod.id === r.productId);
                              return {
                                 name: prod?.nomi || 'Noma\'lum',
                                 qty: r.miqdor,
                                 unit: prod?.olchov || '',
                                 sum: (r.miqdor * r.narx)
                              };
                           });

                           trans.push({
                              sana: p.sana,
                              tur: 'xarid',
                              raqam: p.raqam,
                              jami: p.jami,
                              items: rowItems,
                              izoh: p.izoh
                           });
                        }
                     });

                     // Kassa Payments
                     kassa.forEach((t: any) => {
                        if (t.kontragentId === selectedKontragentId) {
                           trans.push({
                              sana: t.sana,
                              tur: t.tur === 'kirim' ? 'payment_in' : 'payment_out',
                              raqam: '—',
                              jami: t.summa,
                              izoh: t.izoh || (t.tur === 'kirim' ? 'Toʻlov qabul qilindi' : 'Toʻlov amalga oshirildi')
                           });
                        }
                     });

                     trans.sort((a, b) => (b.sana || '').localeCompare(a.sana || ''));

                     return (
                        <div className="card shadow-sm border border-gray-200 overflow-hidden">
                           <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                 <thead>
                                    <tr className="bg-gray-100 border-b text-gray-500 uppercase text-[10px]">
                                       <th className="p-3 text-left font-bold border-r w-32">Sana</th>
                                       <th className="p-3 text-center font-bold border-r w-28">Turi</th>
                                       <th className="p-3 text-center font-bold border-r w-20">№</th>
                                       <th className="p-3 text-left font-bold">Mahsulotlar / Izoh</th>
                                       <th className="p-3 text-right font-bold w-36">Summa</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100">
                                    {trans.map((m, idx) => (
                                       <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                          <td className="p-3 font-mono text-gray-600 border-r">{m.sana}</td>
                                          <td className="p-3 border-r text-center">
                                             <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase whitespace-nowrap ${
                                                m.tur === 'sotuv' ? 'bg-blue-100 text-blue-700' : 
                                                m.tur === 'xarid' ? 'bg-orange-100 text-orange-700' :
                                                m.tur === 'payment_in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                             }`}>
                                                {m.tur === 'sotuv' ? '📊 Sotuv' : m.tur === 'xarid' ? '📦 Xarid' : m.tur === 'payment_in' ? '💰 Kirim' : '💸 Chiqim'}
                                             </span>
                                          </td>
                                          <td className="p-3 font-bold text-gray-700 border-r text-center">{m.raqam}</td>
                                          <td className="p-3">
                                             {m.items ? (
                                                <div className="flex flex-col gap-1">
                                                   {m.items.map((item: any, i: number) => (
                                                      <div key={i} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                         <span className="font-semibold text-gray-800">{item.name}</span>
                                                         <span className="text-gray-500">{fmt(item.qty)} {item.unit} x {fmtSum((item.sum || 0) / (item.qty || 1))}</span>
                                                      </div>
                                                   ))}
                                                   {m.izoh && <div className="text-[10px] text-gray-400 italic mt-1 border-t pt-1">Izoh: {m.izoh}</div>}
                                                </div>
                                             ) : (
                                                <span className="text-gray-500 italic">{m.izoh}</span>
                                             )}
                                          </td>
                                          <td className={`p-3 text-right font-mono font-bold text-sm ${
                                             m.tur === 'sotuv' || m.tur === 'payment_out' ? 'text-blue-700' : 'text-danger'
                                          }`}>
                                             {fmtSum(m.jami)}
                                          </td>
                                       </tr>
                                    ))}
                                    {trans.length === 0 && (
                                       <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic font-medium">Bu davrda harakatlar topilmadi</td></tr>
                                    )}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     );
                  })()}
               </div>
               <div className="p-4 bg-gray-50 border-t flex items-center justify-end print:hidden">
                  <button onClick={() => setSelectedKontragentId(null)} className="btn btn-primary h-9 px-6 text-xs font-bold uppercase">Yopish</button>
               </div>
            </div>
         </div>
      )}

      {selectedProductId && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-6 print:static print:bg-transparent">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col print:h-auto print:shadow-none">
               <div className="p-4 border-b flex items-center justify-between bg-brand text-white rounded-t-xl print:hidden">
                  <h3 className="font-bold uppercase tracking-tight flex items-center gap-2">
                     <Package size={18} />
                     {products.find((p: any) => p.id === selectedProductId)?.nomi} - Harakatlar tarixi
                  </h3>
                  <button onClick={() => setSelectedProductId(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">&times;</button>
               </div>
               <div className="p-4 flex-1 overflow-y-auto space-y-6">
                  <div className="hidden print:block mb-8 border-b pb-4">
                     <h1 className="text-2xl font-bold uppercase">{products.find((p: any) => p.id === selectedProductId)?.nomi}</h1>
                     <p className="text-gray-500">Mahsulot harakati hisoboti: {dateFrom} - {dateTo}</p>
                  </div>

                  {(() => {
                     const prod = products.find((p: any) => p.id === selectedProductId);
                     if (!prod) return null;

                     const movements: any[] = [];
                     
                     // Kirim (Purchases)
                     purchases.forEach((pur: any) => {
                        (pur.rows || []).forEach((r: any) => {
                           if (r.productId === selectedProductId && (pur.sana || "").substring(0, 10) >= dateFrom && (pur.sana || "").substring(0, 10) <= dateTo) {
                              movements.push({
                                 sana: pur.sana,
                                 tur: 'kirim',
                                 raqam: pur.raqam,
                                 kontragent: kontragents.find((k: any) => k.id === pur.kontragentId)?.nomi || '—',
                                 miqdor: Number(r.miqdor || 0),
                                 narx: Number(r.narx || 0),
                                 jami: Number(r.miqdor || 0) * Number(r.narx || 0),
                                 olchov: prod.olchov
                              });
                           }
                        });
                     });

                     // Chiqim (Sales)
                     sales.forEach((sal: any) => {
                        (sal.rows || []).forEach((r: any) => {
                           if (r.productId === selectedProductId && (sal.sana || "").substring(0, 10) >= dateFrom && (sal.sana || "").substring(0, 10) <= dateTo) {
                              movements.push({
                                 sana: sal.sana,
                                 tur: 'chiqim',
                                 raqam: sal.raqam,
                                 kontragent: kontragents.find((k: any) => k.id === sal.kontragentId)?.nomi || '—',
                                 miqdor: Number(r.miqdor || 0),
                                 narx: Number(r.narx || 0),
                                 jami: Number(r.summa || 0), // This is total for that item in sale
                                 olchov: prod.olchov
                              });
                           }
                        });
                     });

                     movements.sort((a, b) => a.sana.localeCompare(b.sana));

                     const startKirim = purchases.filter((d: any) => (d.sana || "").substring(0, 10) < dateFrom)
                                 .reduce((a: number, d: any) => a + (d.rows || []).filter((r: any) => r.productId === selectedProductId).reduce((sum: number, r: any) => sum + Number(r.miqdor || 0), 0), 0);
                     const startChiqim = sales.filter((d: any) => (d.sana || "").substring(0, 10) < dateFrom)
                                 .reduce((a: number, d: any) => a + (d.rows || []).filter((r: any) => r.productId === selectedProductId).reduce((sum: number, r: any) => sum + Number(r.miqdor || 0), 0), 0);
                     
                     const initialBalance = startKirim - startChiqim;
                     let runningBalance = initialBalance;

                     return (
                        <div className="card shadow-sm border border-gray-200 overflow-hidden">
                           <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                 <thead>
                                    <tr className="bg-gray-100 border-b">
                                       <th className="p-3 text-left font-bold uppercase text-[10px] text-gray-500 w-32 border-r">Sana</th>
                                       <th className="p-3 text-left font-bold uppercase text-[10px] text-gray-500 w-32 border-r text-center">Turi</th>
                                       <th className="p-3 text-left font-bold uppercase text-[10px] text-gray-500 w-24 border-r text-center">#</th>
                                       <th className="p-3 text-left font-bold uppercase text-[10px] text-gray-500">Kontragent</th>
                                       <th className="p-3 text-right font-bold uppercase text-[10px] text-gray-500 w-24">Miqdor</th>
                                       <th className="p-3 text-right font-bold uppercase text-[10px] text-gray-500 w-32">Narx</th>
                                       <th className="p-3 text-right font-bold uppercase text-[10px] text-gray-500 w-32 border-l">Summa</th>
                                       <th className="p-3 text-right font-bold uppercase text-[10px] text-gray-500 w-32 bg-gray-50">Qoldiq</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100">
                                    <tr className="bg-blue-50/50 italic">
                                       <td colSpan={7} className="p-3 text-right font-bold uppercase text-[10px]">Davr boshiga qoldiq:</td>
                                       <td className="p-3 text-right font-mono font-bold bg-blue-50/30">{fmt(initialBalance)}</td>
                                    </tr>
                                    {movements.map((m, idx) => {
                                       if (m.tur === 'kirim') runningBalance += m.miqdor;
                                       else runningBalance -= m.miqdor;
                                       return (
                                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                             <td className="p-3 font-mono text-gray-600 border-r">{m.sana}</td>
                                             <td className="p-3 border-r text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${m.tur === 'kirim' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                   {m.tur === 'kirim' ? '📥 Kirim' : '📤 Chiqim'}
                                                </span>
                                             </td>
                                             <td className="p-3 font-bold text-brand border-r text-center">{m.raqam}</td>
                                             <td className="p-3 text-gray-700">{m.kontragent}</td>
                                             <td className="p-3 text-right font-bold">{fmt(m.miqdor)}</td>
                                             <td className="p-3 text-right font-mono text-gray-500">{fmtSum(m.narx)}</td>
                                             <td className="p-3 text-right font-mono font-bold border-l">{fmtSum(m.jami)}</td>
                                             <td className={`p-3 text-right font-mono font-bold bg-gray-50/50 ${runningBalance < 0 ? 'text-danger' : 'text-gray-900'}`}>{fmt(runningBalance)}</td>
                                          </tr>
                                       );
                                    })}
                                 </tbody>
                                 <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                       <td colSpan={7} className="p-3 text-right uppercase text-[10px]">Davr oxiriga qoldiq:</td>
                                       <td className="p-3 text-right font-mono text-base bg-gray-200">{fmt(runningBalance)} {prod.olchov} {prod.olchov}</td>
                                    </tr>
                                 </tfoot>
                              </table>
                           </div>
                        </div>
                     );
                  })()}
               </div>
               <div className="p-4 bg-gray-50 border-t flex items-center justify-end print:hidden">
                  <button onClick={() => setSelectedProductId(null)} className="btn btn-primary h-9 px-6 text-xs font-bold uppercase">Yopish</button>
               </div>
            </div>
         </div>
      )}
     </div>
   );
 }

// ─── KASSA PAGE ───────────────────────────────────────────────────────────────

function KassaPage({ transactions, kontragents, onSave, onDelete }: any) {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'barchasi' | 'kirim' | 'chiqim'>('barchasi');
  const [isModal, setIsModal] = useState(false);
  const [modalType, setModalType] = useState<'kirim' | 'chiqim'>('kirim');
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [sortBy, setSortBy] = useState<'sana' | 'summa'>('sana');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'sana' | 'summa') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = transactions.filter((t: any) => {
      const kName = kontragents.find((k: any) => k.id === t.kontragentId)?.nomi || t.nomi || '';
      const matchQ = kName.toLowerCase().includes(q.toLowerCase()) || (t.izoh || '').toLowerCase().includes(q.toLowerCase());
      const matchType = typeFilter === 'barchasi' || t.tur === typeFilter;
      const matchDate = (t.sana || "").substring(0, 10) >= dateFrom && (t.sana || "").substring(0, 10) <= dateTo;
      return matchQ && matchType && matchDate;
    });

    result.sort((a: any, b: any) => {
      if (sortBy === 'summa') {
        return sortOrder === 'asc' ? a.summa - b.summa : b.summa - a.summa;
      }
      return sortOrder === 'asc' 
        ? a.sana.localeCompare(b.sana) 
        : b.sana.localeCompare(a.sana);
    });

    return result;
  }, [transactions, q, typeFilter, dateFrom, dateTo, sortBy, sortOrder, kontragents]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between bg-[#f8f9fa] p-2 border-b border-border">
         <div className="flex gap-2">
            <button 
              onClick={() => { setEditingTransaction(null); setModalType('kirim'); setIsModal(true); }} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-sm"
            >
              <Plus size={14} className="text-green-600" /> Kirim
            </button>
            <button 
              onClick={() => { setEditingTransaction(null); setModalType('chiqim'); setIsModal(true); }} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-sm"
            >
              <Minus size={14} className="text-red-600" /> Chiqim
            </button>
         </div>
         <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} className="h-8 pl-8 pr-3 text-xs border border-gray-300 rounded focus:border-brand focus:ring-1 focus:ring-brand outline-none w-48 sm:w-64" placeholder="Qidiruv (To'lovchi / Oluvchi nomi)..." />
            </div>
            <button className="h-8 px-3 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700">Barchasi</button>
         </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end bg-white p-3 rounded-lg border border-border shadow-sm">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Dan:</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded outline-none w-full" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Gacha:</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded outline-none w-full" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Turi:</label>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="h-8 px-2 text-xs border border-gray-300 rounded outline-none w-full bg-white">
                <option value="barchasi">Barcha amallar</option>
                <option value="kirim">Kirim</option>
                <option value="chiqim">Chiqim</option>
              </select>
            </div>
         </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-[#f2f2f2] border-b border-gray-300">
                <th className="p-2 text-center text-[11px] font-semibold text-gray-600 border-r border-gray-300 w-10">#</th>
                <th className="p-2 text-left text-[11px] font-semibold text-gray-600 border-r border-gray-300 w-28 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sana')}>
                   <div className="flex items-center gap-1">
                      Sana 
                      <div className="flex flex-col opacity-40">
                         <ChevronUp size={10} className={sortBy === 'sana' && sortOrder === 'asc' ? 'opacity-100 text-brand' : ''} />
                         <ChevronDown size={10} className={sortBy === 'sana' && sortOrder === 'desc' ? 'opacity-100 text-brand' : ''} />
                      </div>
                   </div>
                </th>
                <th className="p-2 text-right text-[11px] font-semibold text-gray-600 border-r border-gray-300 w-32 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('summa')}>
                   <div className="flex items-center justify-end gap-1">
                      Summa 
                      <div className="flex flex-col opacity-40">
                         <ChevronUp size={10} className={sortBy === 'summa' && sortOrder === 'asc' ? 'opacity-100 text-brand' : ''} />
                         <ChevronDown size={10} className={sortBy === 'summa' && sortOrder === 'desc' ? 'opacity-100 text-brand' : ''} />
                      </div>
                   </div>
                </th>
                <th className="p-2 text-left text-[11px] font-semibold text-gray-600 border-r border-gray-300">To'lovchi / Oluvchi nomi</th>
                <th className="p-2 text-left text-[11px] font-semibold text-gray-600 w-56">Izoh</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {filtered.map((t: any, idx: number) => {
                const kontragent = kontragents.find((k: any) => k.id === t.kontragentId);
                const d = (t.sana || "").split(' ')[0].split('-');
                const formattedDate = d.length === 3 ? `${d[2]}-${d[1]}-${d[0]}` : (t.sana || "");
                return (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-[#fff9e6] cursor-pointer group" onClick={() => { setEditingTransaction(t); setModalType(t.tur); setIsModal(true); }}>
                    <td className="p-2 border-r border-gray-100 text-center text-gray-400 font-bold">{idx + 1}</td>
                    <td className="p-2 border-r border-gray-100 text-gray-600 align-middle">
                      {formattedDate}
                    </td>
                    <td className={`p-2 border-r border-gray-100 text-right font-medium align-middle ${t.tur === 'kirim' ? 'text-green-700' : 'text-red-600'}`}>
                      {t.tur === 'kirim' ? '' : '-'}{fmtSum(t.summa).replace(' sum', '')}
                    </td>
                    <td className="p-2 border-r border-gray-100 align-middle text-blue-800 font-medium whitespace-pre-wrap">
                      {kontragent?.nomi || t.nomi || '—'}
                    </td>
                    <td className="p-2 align-middle text-gray-500 italic relative">
                      {t.izoh || '—'}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                         <button className="p-1 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-blue-600">✏️</button>
                         <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} className="p-1.5 bg-white border border-gray-200 rounded shadow-sm hover:bg-red-50 text-red-600 transition-colors" title="O'chirish"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic bg-gray-50">Ma'lumot mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center px-2 py-1 bg-gray-50 border border-gray-300 rounded-sm text-[11px] font-medium text-gray-600">
        <div>Ko'rsatildi: {filtered.length}</div>
        <div className="flex gap-6">
           <div className="flex gap-2">Jami kirim: <span className="text-green-700 font-bold">{fmtSum(filtered.filter(t => t.tur === 'kirim').reduce((a, b) => a + b.summa, 0))}</span></div>
           <div className="flex gap-2">Jami chiqim: <span className="text-red-600 font-bold">{fmtSum(filtered.filter(t => t.tur === 'chiqim').reduce((a, b) => a + b.summa, 0))}</span></div>
        </div>
      </div>

      {isModal && (
        <KassaModal 
          type={modalType}
          initial={editingTransaction}
          kontragents={kontragents}
          onSave={(t: any) => { onSave(t); setIsModal(false); }}
          onClose={() => setIsModal(false)}
        />
      )}
    </div>
  );
}

function KassaModal({ type, initial, kontragents, onSave, onClose }: any) {
  const [t, setT] = useState<any>(initial || { 
    nomi: '', 
    tur: type, 
    summa: 0, 
    kontragentId: '',
    sana: new Date().toISOString().slice(0, 16).replace('T', ' '), 
    izoh: '' 
  });

  const [searchK, setSearchK] = useState('');
  const [showKList, setShowKList] = useState(false);

  const filteredK = kontragents.filter((k: any) => 
    k.nomi.toLowerCase().includes(searchK.toLowerCase()) ||
    k.tel?.includes(searchK)
  );

  const selectedK = kontragents.find((k: any) => k.id === t.kontragentId);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className={`p-4 border-b flex justify-between items-center ${type === 'kirim' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
           <h3 className="font-bold flex items-center gap-2">
             {type === 'kirim' ? <Plus size={18} /> : <Minus size={18} />}
             {type === 'kirim' ? 'Yangi Kirim' : 'Yangi Chiqim'}
           </h3>
           <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
            <div className="relative">
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                {type === 'kirim' ? "To'lovchi (Kontragent) *" : "Oluvchi (Kontragent) *"}
              </label>
              {selectedK ? (
                <div className="flex items-center justify-between p-2.5 border border-brand bg-blue-50 rounded-lg">
                   <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-sm">{selectedK.nomi}</span>
                      <span className="text-[10px] text-gray-500 uppercase font-bold">{selectedK.tur}</span>
                   </div>
                   <button onClick={() => { setT({...t, kontragentId: ''}); setSearchK(''); }} className="text-red-500 hover:bg-red-50 p-1 rounded">
                      <X size={16} />
                   </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      value={searchK} 
                      onFocus={() => setShowKList(true)}
                      onChange={val => setSearchK(val.target.value)} 
                      className="input pl-9" 
                      placeholder="To'lovchi yoki oluvchini qidiring..." 
                    />
                  </div>
                  {showKList && searchK && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border shadow-xl rounded-lg z-20 max-h-[200px] overflow-y-auto">
                       {filteredK.length > 0 ? filteredK.map((k: any) => (
                         <div 
                           key={k.id} 
                           onClick={() => { setT({...t, kontragentId: k.id}); setShowKList(false); }}
                           className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex flex-col"
                         >
                            <span className="font-bold text-sm text-gray-800">{k.nomi}</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold">{k.tur} • {k.tel || 'Tel yo\'q'} {k.tel2 ? `• ${k.tel2}` : ''}</span>
                         </div>
                       )) : (
                         <div className="p-4 text-center text-gray-400 italic text-sm">Topilmadi</div>
                       )}
                    </div>
                  )}
                </>
              )}
           </div>
           <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sana *</label>
              <input 
                type="date" 
                value={(t.sana || '').substring(0, 10)} 
                onChange={e => {
                  const time = (t.sana || '').split(' ')[1] || '00:00:00';
                  setT({ ...t, sana: e.target.value + ' ' + time });
                }} 
                className="input" 
                required 
              />
           </div>
           <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Summa *</label>
              <input 
                type="text" 
                inputMode="numeric"
                value={fmtInput(t.summa)} 
                onChange={val => setT({ ...t, summa: parseSum(val.target.value) })} 
                className="input font-mono font-bold text-lg" 
                required 
              />
           </div>
           <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Izoh</label>
              <textarea 
                value={t.izoh} 
                onChange={val => setT({ ...t, izoh: val.target.value })} 
                className="input min-h-[80px] py-2" 
                placeholder="Qo'shimcha tafsilotlar..."
              />
           </div>
        </div>
        <div className="p-4 bg-gray-50 border-t flex gap-2 justify-end">
           <button onClick={onClose} className="btn btn-secondary h-10 text-xs uppercase font-bold">Bekor</button>
           <button 
             onClick={() => {
               if(!t.kontragentId || !t.summa) return alert("Kontragent va summani kiriting!");
               onSave({ ...t, id: t.id || 't' + Date.now() });
             }} 
             className={`btn h-10 px-8 text-xs uppercase font-bold text-white ${type === 'kirim' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
           >
             💾 Saqlash
           </button>
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS / DATA PAGE ───────────────────────────────────────────────────

function SettingsPage({ 
  products, 
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct, 
  kontragents, 
  onAddKontragent, 
  onUpdateKontragent, 
  onDeleteKontragent 
}: any) {
  const [tab, setTab] = useState<'m' | 'k'>('m');
  const [isMModal, setIsMModal] = useState(false);
  const [editingM, setEditingM] = useState<any>(null);
  const [isKModal, setIsKModal] = useState(false);
  const [editingK, setEditingK] = useState<any>(null);

  const deleteKontragent = (id: string) => {
    onDeleteKontragent(id);
  };

  const deleteProduct = (id: string) => {
    onDeleteProduct(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-gray-200 w-full sm:w-auto rounded-lg h-10 print:hidden">
        <button onClick={() => setTab('m')} className={`flex-1 sm:flex-none px-4 rounded-md font-bold text-xs uppercase transition-all ${tab === 'm' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Mahsulotlar</button>
        <button onClick={() => setTab('k')} className={`flex-1 sm:flex-none px-4 rounded-md font-bold text-xs uppercase transition-all ${tab === 'k' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Kontragentlar</button>
      </div>

      {tab === 'm' ? (
        <div className="card">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold">📦 Nomenklatura</h3>
            <button onClick={() => { setEditingM(null); setIsMModal(true); }} className="btn btn-primary btn-sm h-8 py-0 gap-2 font-bold text-xs uppercase">Qo'shish</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px]">
              <thead>
              <tr>
                <th className="table-header p-3 text-left">Mahsulot nomi</th>
                <th className="table-header p-3 text-left">O'lchov</th>
                <th className="table-header p-3 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold">{p.nomi}</td>
                  <td className="p-3 text-xs uppercase text-gray-400 font-bold">{p.olchov}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditingM(p); setIsMModal(true); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded">✏️</button>
                      <button onClick={() => deleteProduct(p.id)} className="p-2 hover:bg-red-50 text-danger rounded"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      ) : (
        <div className="card">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold">👥 Kontragentlar</h3>
            <button onClick={() => { setEditingK(null); setIsKModal(true); }} className="btn btn-primary btn-sm h-8 py-0 gap-2 font-bold text-xs uppercase">Qo'shish</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
              <tr>
                <th className="table-header p-3">Kontragent nomi</th>
                <th className="table-header p-3">Turi</th>
                <th className="table-header p-3">Telefonlar</th>
                <th className="table-header p-3 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kontragents.map((k: any) => (
                <tr key={k.id} className="hover:bg-gray-50 group">
                  <td className="p-3 font-semibold">{k.nomi}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${k.tur === 'xaridor' ? 'bg-blue-100 text-blue-700' : k.tur === 'yetkazuvchi' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {k.tur}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5">
                       <span className="text-sm font-mono font-bold text-gray-700">{k.tel || '—'}</span>
                       {k.tel2 && <span className="text-[10px] font-mono text-gray-400">{k.tel2}</span>}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditingK(k); setIsKModal(true); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded">✏️</button>
                      <button onClick={() => deleteKontragent(k.id)} className="p-2 hover:bg-red-50 text-danger rounded"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {isMModal && (
        <MahsulotModal 
           initial={editingM}
           onSave={(m: any) => {
             if (editingM) onUpdateProduct(m);
             else onAddProduct(m);
             setIsMModal(false);
           }}
           onClose={() => setIsMModal(false)}
        />
      )}

      {isKModal && (
        <KEditModal 
          initial={editingK}
          onSave={(k: any) => {
            if (editingK) onUpdateKontragent(k);
            else onAddKontragent(k);
            setIsKModal(false);
          }}
          onClose={() => setIsKModal(false)}
        />
      )}
    </div>
  );
}

function KEditModal({ initial, onSave, onClose }: any) {
  const [k, setK] = useState<any>(initial || { nomi: '', tur: 'xaridor', tel: '', tel2: '' });

  const formatPhoneInput = (val: string) => {
    let x = val.replace(/\D/g, '').match(/(\d{0,3})(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!x) return val;
    if (!x[1]) return "";
    let res = (x[1] === '998' ? '+' : '') + x[1];
    if (x[2]) res += ' ' + x[2];
    if (x[3]) res += ' ' + x[3];
    if (x[4]) res += '-' + x[4];
    if (x[5]) res += '-' + x[5];
    return res;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
       <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
          <div className="bg-gray-50 p-4 border-b flex justify-between items-center text-brand">
             <h3 className="font-bold">Kontragent ma'lumotlari</h3>
             <button onClick={onClose}><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
             <div>
               <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Nomi</label>
               <input value={k.nomi} onChange={e => setK({ ...k, nomi: e.target.value })} className="input font-bold" placeholder="Firma yoki shaxs nomi" />
             </div>
             <div>
               <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Turi</label>
               <select className="input font-bold" value={k.tur} onChange={e => setK({ ...k, tur: e.target.value })}>
                 <option value="xaridor">Xaridor</option>
                 <option value="yetkazuvchi">Yetkazuvchi</option>
                 <option value="boshqa">Boshqa</option>
               </select>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Asosiy Telefon</label>
                  <input 
                    value={k.tel} 
                    onChange={e => setK({ ...k, tel: formatPhoneInput(e.target.value) })} 
                    className="input font-mono font-bold text-blue-700" 
                    placeholder="+998 90 123-45-67" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Qo'shimcha Telefon</label>
                  <input 
                    value={k.tel2} 
                    onChange={e => setK({ ...k, tel2: formatPhoneInput(e.target.value) })} 
                    className="input font-mono font-bold text-blue-700" 
                    placeholder="+998 91 765-43-21" 
                  />
                </div>
             </div>
             <div>
               <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Manzil (Ixtiyoriy)</label>
               <input value={k.manzil || ''} onChange={e => setK({ ...k, manzil: e.target.value })} className="input" placeholder="Shahar, tuman, ko'cha..." />
             </div>
          </div>
          <div className="p-4 bg-gray-50 border-t flex gap-2 justify-end">
             <button onClick={onClose} className="btn btn-secondary h-10 text-xs uppercase font-bold">Bekor</button>
             <button onClick={() => onSave({ id: k.id || 'k' + Date.now(), ...k })} className="btn btn-primary px-8 h-10 text-xs uppercase font-bold">💾 Saqlash</button>
          </div>
       </div>
    </div>
  );
}

// ─── EXPENSES PAGE ───────────────────────────────────────────────────────────

function ExpensesPage({ expenses, onSave, onDelete }: any) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Barchasi');
  const [isModal, setIsModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const categories = ['Barchasi', 'Ijara', 'Maosh', 'Kommunal', 'Marketing', 'Boshqa'];

  const filtered = expenses.filter((e: any) => {
    const matchQ = e.nomi.toLowerCase().includes(q.toLowerCase());
    const matchCat = cat === 'Barchasi' || e.kategoriya === cat;
    const matchDate = e.sana >= dateFrom && e.sana <= dateTo;
    return matchQ && matchCat && matchDate;
  });

  const total = filtered.reduce((a, b) => a + b.summa, 0);
  const thisMonth = filtered.filter(e => (e.sana || "").startsWith(new Date().toISOString().slice(0, 7))).reduce((a, b) => a + b.summa, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end justify-between bg-white p-4 rounded-lg border border-border shadow-sm">
         <div className="flex-1 min-w-[200px] grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sana (Dan)</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sana (Gacha)</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Kategoriya</label>
              <select value={cat} onChange={e => setCat(e.target.value)} className="input">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Qidirish</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={q} onChange={e => setQ(e.target.value)} className="input pl-9" placeholder="Qidirish..." />
              </div>
            </div>
         </div>
         <button onClick={() => { setEditingExpense(null); setIsModal(true); }} className="btn btn-accent h-10 gap-2 font-bold text-sm">➕ Yangi xarajat</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
         <div className="card p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Jami xarajat</p>
            <h3 className="text-xl font-bold font-mono text-brand">{fmtSum(total)}</h3>
         </div>
         <div className="card p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Bu oy</p>
            <h3 className="text-xl font-bold font-mono text-danger">{fmtSum(thisMonth)}</h3>
         </div>
         <div className="card p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Yozuvlar soni</p>
            <h3 className="text-xl font-bold font-mono">{filtered.length}</h3>
         </div>
         <div className="card p-4 bg-gray-50 flex items-center justify-center italic text-gray-400 text-xs">
            Filtr bo'yicha ma'lumotlar
         </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="table-header p-3 w-12 text-center">#</th>
                <th className="table-header p-3">Sana</th>
                <th className="table-header p-3">Nomi</th>
                <th className="table-header p-3">Kategoriya</th>
                <th className="table-header p-3 text-right">Summa</th>
                <th className="table-header p-3 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((e: any, i: number) => (
                <tr 
                  key={e.id} 
                  className="hover:bg-gray-50 group cursor-pointer"
                  onDoubleClick={() => { setEditingExpense(e); setIsModal(true); }}
                >
                  <td className="p-3 text-center text-xs text-gray-400">{i+1}</td>
                  <td className="p-3 text-xs text-gray-500">{e.sana}</td>
                  <td className="p-3 font-semibold">{e.nomi}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-100">{e.kategoriya}</span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold">{fmtSum(e.summa)}</td>
                  <td className="p-3 text-center" onClick={ev => ev.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button 
                         onClick={() => { setEditingExpense(e); setIsModal(true); }} 
                         className="p-2 hover:bg-blue-50 text-blue-600 rounded"
                         title="O'zgartirish"
                      >
                        ✏️
                      </button>
                      <button onClick={() => onDelete(e.id)} className="p-2 hover:bg-red-50 text-danger rounded transition-opacity"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Xarajatlar topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModal && (
        <ExpenseModal 
          initial={editingExpense}
          categories={categories.slice(1)}
          onSave={(exp: any) => { onSave(exp); setIsModal(false); setEditingExpense(null); }}
          onClose={() => { setIsModal(false); setEditingExpense(null); }}
        />
      )}
    </div>
  );
}

function ExpenseModal({ initial, categories, onSave, onClose }: any) {
  const [e, setE] = useState<any>(initial || { nomi: '', kategoriya: categories[0], summa: 0, sana: new Date().toISOString().slice(0, 10), izoh: '' });

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center text-success">
           <h3 className="font-bold flex items-center gap-2">💸 {initial ? "Xarajatni tahrirlash" : "Yangi xarajat"}</h3>
           <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sana</label>
                <input type="date" value={e.sana} onChange={val => setE({ ...e, sana: val.target.value })} className="input" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Kategoriya</label>
                <select value={e.kategoriya} onChange={val => setE({ ...e, kategoriya: val.target.value })} className="input">
                  {categories.map((c: any) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Nomi *</label>
                <input value={e.nomi} onChange={val => setE({ ...e, nomi: val.target.value })} className="input" placeholder="Xarajat nomi" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Summa *</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={fmtInput(e.summa)} 
                  onChange={val => setE({ ...e, summa: parseSum(val.target.value) })} 
                  className="input font-mono font-bold" 
                />
              </div>
           </div>
           <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Izoh</label>
              <input value={e.izoh} onChange={val => setE({ ...e, izoh: val.target.value })} className="input" placeholder="Qo'shimcha ma'lumot..." />
           </div>
        </div>
        <div className="p-4 bg-gray-50 border-t flex gap-2 justify-end">
           <button onClick={() => onSave({ ...e, id: e.id || 'e' + Date.now() })} className="btn btn-primary bg-green-700 hover:bg-green-800 px-8 h-10 text-xs uppercase">💾 Saqlash</button>
           <button onClick={onClose} className="btn btn-secondary h-10 text-xs uppercase">Bekor</button>
        </div>
      </div>
    </div>
  );
}

function MahsulotModal({ initial, onSave, onClose }: any) {
  const [m, setM] = useState<Partial<Product>>(initial || { nomi: '', olchov: 'kg', sotishNarxi: 0, xaridNarxi: 0, qoldiq: 0 });

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
       <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
          <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
             <h3 className="font-bold">Mahsulot ma'lumotlari</h3>
             <button onClick={onClose}><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
             <div>
               <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Nomi *</label>
               <input value={m.nomi} onChange={e => setM({ ...m, nomi: e.target.value })} className="input" placeholder="Mahsulot nomi" />
             </div>
             <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">O'lchov birligi</label>
                <select className="input h-10" value={m.olchov} onChange={e => setM({ ...m, olchov: e.target.value })}>
                  <option value="kg">kg</option>
                  <option value="gr">gr</option>
                  <option value="dona">dona</option>
                  <option value="litr">litr</option>
                  <option value="metr">metr</option>
                  <option value="tonna">tonna</option>
                  <option value="qop">qop</option>
                  <option value="blok">blok</option>
                  <option value="pachka">pachka</option>
                  <option value="karobka">karobka</option>
                  <option value="komplekt">komplekt</option>
                </select>
             </div>
          </div>
          <div className="p-4 bg-gray-50 border-t flex gap-2 justify-end">
             <button onClick={onClose} className="btn btn-secondary text-xs uppercase h-9">Bekor qilish</button>
             <button onClick={() => onSave({ id: m.id || 'm' + Date.now(), ...m })} className="btn btn-primary px-8 h-9 text-xs uppercase font-bold">Saqlash</button>
          </div>
       </div>
    </div>
  );
}

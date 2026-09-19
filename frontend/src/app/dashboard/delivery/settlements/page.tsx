'use client';
import { useState, useEffect } from 'react';
import { Wallet, IndianRupee, Clock, CheckCircle, Package, User } from 'lucide-react';
import api from '@/lib/axios';

export default function SettlementsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/delivery/summary');
      setSummary(res.data.data);
    } catch (error) {
      console.error('Failed to fetch summary', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (liabilityId: string) => {
    try {
      setPayingId(liabilityId);
      const res = await api.post('/delivery/settle', { liabilityId });
      if (res.data.success && res.data.data.paymentUrl) {
        window.location.href = res.data.data.paymentUrl;
      }
    } catch (error) {
      console.error('Failed to initiate payment', error);
      alert('Could not start payment. Please try again.');
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const liabilities = summary?.liabilities || [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-[#1B5E20] mb-2 flex items-center gap-3">
            <Wallet className="text-[#FFC107]" /> Cash Settlements
          </h1>
          <p className="text-gray-500 font-medium">Pay pending COD amounts collected from buyers.</p>
        </div>
        <div className="bg-orange-50 px-6 py-4 rounded-2xl border border-orange-100 flex flex-col items-end">
          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Total Due</span>
          <span className="text-2xl font-black text-orange-600 flex items-center">
            <IndianRupee size={20} />{summary?.totalPendingAmount || 0}
          </span>
        </div>
      </div>

      {liabilities.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">All Settled!</h3>
          <p className="text-gray-500 font-medium max-w-md mx-auto">You have no pending cash liabilities. Great job keeping your accounts clear!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 text-lg flex items-center gap-2">
            Pending Orders <span className="bg-gray-100 text-gray-600 text-xs py-1 px-3 rounded-full">{summary?.totalPendingOrders || 0}</span>
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {liabilities.map((l: any) => (
              <div key={l.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-orange-400" />
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                      <Package className="text-orange-500 w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{l.order.crop.name} - {l.order.quantityKg} kg</p>
                      <p className="text-xs text-gray-400 font-medium font-mono">ID: {l.orderId.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-gray-800 flex items-center justify-end">
                      <IndianRupee size={16} />{l.amount}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Amount Due</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 mb-4 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <User size={14} className="text-gray-400" />
                    {l.order.buyer?.name || 'Buyer'}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Clock size={14} className="text-gray-400" />
                    {new Date(l.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <button 
                  onClick={() => handlePay(l.id)}
                  disabled={payingId === l.id}
                  className="w-full bg-[#1B5E20] hover:bg-[#144716] disabled:bg-gray-300 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {payingId === l.id ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Pay <IndianRupee size={14} strokeWidth={3} /> {l.amount}</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

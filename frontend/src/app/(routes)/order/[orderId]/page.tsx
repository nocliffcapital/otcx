'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Lock, ExternalLink, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useOrderbook } from '@/hooks/useOrderbook';
import { formatUnits } from 'viem';
import { STABLE_DECIMALS } from '@/lib/contracts';
import { useToast } from '@/components/Toast';

export default function PrivateOrderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const { getOrder, takeOrder, getProjectById } = useOrderbook();
  const toast = useToast();
  
  const orderId = params.orderId as string;
  const allowedTaker = searchParams.get('taker') as `0x${string}` | null;
  
  const [order, setOrder] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [taking, setTaking] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      if (!orderId) return;
      
      try {
        setLoading(true);
        const orderData = await getOrder(BigInt(orderId));
        
        console.log('Order data:', orderData);
        
        if (!orderData) {
          toast.error('Order not found', 'This order does not exist or has been removed');
          return;
        }
        
        setOrder(orderData);
        
        // Load project data
        console.log('Fetching project with ID:', orderData.projectId);
        const projectData = await getProjectById(orderData.projectId);
        console.log('Project data:', projectData);
        setProject(projectData);
        
        // Check if user is authorized
        if (address && allowedTaker) {
          setIsAuthorized(address.toLowerCase() === allowedTaker.toLowerCase());
        }
      } catch (error) {
        console.error('Error loading order:', error);
        toast.error('Failed to load order', 'Please try again later');
      } finally {
        setLoading(false);
      }
    }
    
    loadOrder();
  }, [orderId, address, allowedTaker, getOrder, getProjectById, toast]);

  const handleTakeOrder = async () => {
    if (!order || !address || !isAuthorized) return;
    
    try {
      setTaking(true);
      await takeOrder(BigInt(orderId));
      toast.success('Order taken successfully!', 'The order has been filled');
      
      // Reload order data
      const updatedOrder = await getOrder(BigInt(orderId));
      setOrder(updatedOrder);
    } catch (error: any) {
      console.error('Error taking order:', error);
      toast.error('Failed to take order', error?.message || 'Please try again');
    } finally {
      setTaking(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-zinc-400">Loading private order...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!order || !order.amount || !order.unitPrice) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center border-red-500/30 bg-red-950/10">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Order Not Found</h1>
            <p className="text-zinc-400 mb-6">This order does not exist or has been removed.</p>
            <Link href="/markets">
              <Button>Back to Markets</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const isSellOrder = order.isSell;
  const amount = formatUnits(order.amount, project?.isPoints ? 18 : 18);
  const unitPrice = formatUnits(order.unitPrice, STABLE_DECIMALS);
  const total = formatUnits(order.amount * order.unitPrice / BigInt(10 ** 18), STABLE_DECIMALS);
  const isOpen = order.status === 0; // OPEN status

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Lock className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Private Order
            </h1>
          </div>
          <p className="text-zinc-400">This is a private order. Only the specified address can take it.</p>
        </div>

        {/* Order Details */}
        <Card className="p-6 border-purple-500/30 bg-purple-950/10">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white">Order Details</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isSellOrder 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}>
                {isSellOrder ? 'SELL' : 'BUY'} ORDER
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-zinc-500 mb-1">Project</p>
                <p className="text-white font-medium">{project?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 mb-1">Asset Type</p>
                <p className="text-white font-medium">{project?.isPoints ? 'Points' : 'Tokens'}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 mb-1">Amount</p>
                <p className="text-white font-medium">{amount}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 mb-1">Unit Price</p>
                <p className="text-white font-medium">${unitPrice}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-zinc-500 mb-1">Total Value</p>
                <p className="text-2xl font-bold text-cyan-400">${total}</p>
              </div>
            </div>

            {allowedTaker && (
              <div className="pt-4 border-t border-zinc-800">
                <p className="text-sm text-zinc-500 mb-1">Allowed Taker</p>
                <p className="text-white font-mono text-xs break-all">{allowedTaker}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Authorization Status */}
        {!address ? (
          <Card className="p-6 border-yellow-500/30 bg-yellow-950/10 text-center">
            <p className="text-yellow-400 font-medium mb-4">Please connect your wallet to view this order</p>
            <Button variant="outline" className="border-yellow-500/30">
              Connect Wallet
            </Button>
          </Card>
        ) : !isAuthorized ? (
          <Card className="p-6 border-red-500/30 bg-red-950/10 text-center">
            <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-red-400 mb-2">Not Authorized</h3>
            <p className="text-zinc-400 mb-2">This order is restricted to a specific address.</p>
            <p className="text-xs text-zinc-500 font-mono break-all">Your address: {address}</p>
          </Card>
        ) : !isOpen ? (
          <Card className="p-6 border-zinc-700 bg-zinc-900/50 text-center">
            <h3 className="text-xl font-bold text-zinc-400 mb-2">Order No Longer Available</h3>
            <p className="text-zinc-500">This order has already been taken or cancelled.</p>
          </Card>
        ) : (
          <Card className="p-6 border-green-500/30 bg-green-950/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">You're Authorized!</h3>
                <p className="text-sm text-zinc-400">You can take this order</p>
              </div>
            </div>
            
            <Button 
              onClick={handleTakeOrder}
              disabled={taking}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              {taking ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Taking Order...
                </>
              ) : (
                <>
                  Take Order
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </Card>
        )}

        {/* Back Link */}
        <div className="text-center">
          <Link href="/markets" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            View All Markets
          </Link>
        </div>
      </div>
    </div>
  );
}


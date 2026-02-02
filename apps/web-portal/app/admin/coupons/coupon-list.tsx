'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Tag, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CouponWithStats {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  isActive: boolean | null;
  validFrom: Date | null;
  validUntil: Date | null;
  maxRedemptions: number | null;
  currentRedemptions: number | null;
  firstTimeOnly: boolean | null;
  createdAt: Date | null;
  stats: {
    redemptions: number;
    totalSaved: number;
  };
}

interface CouponListProps {
  coupons: CouponWithStats[];
}

export function CouponList({ coupons }: CouponListProps) {
  const router = useRouter();
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Coupon code copied!');
  };

  const deactivateCoupon = async (couponId: string) => {
    setDeactivating(couponId);
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate coupon');
      }

      toast.success('Coupon deactivated');
      router.refresh();
    } catch {
      toast.error('Failed to deactivate coupon');
    } finally {
      setDeactivating(null);
    }
  };

  const formatDiscount = (type: string, value: number) => {
    return type === 'percent' ? `${value}% off` : `$${(value / 100).toFixed(2)} off`;
  };

  if (coupons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All Coupons</CardTitle>
          <CardDescription>No coupons created yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Create your first coupon to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Coupons ({coupons.length})</CardTitle>
        <CardDescription>Manage your discount coupons</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="font-mono font-bold text-lg">{coupon.code}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyCode(coupon.code)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {coupon.isActive ? (
                    <Badge className="bg-green-100 text-green-700">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-2">
                  {coupon.description || 'No description'}
                </p>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    {formatDiscount(coupon.discountType, coupon.discountValue)}
                  </Badge>

                  {coupon.maxRedemptions && (
                    <Badge variant="outline">
                      {coupon.currentRedemptions ?? 0}/{coupon.maxRedemptions} used
                    </Badge>
                  )}

                  {coupon.firstTimeOnly && (
                    <Badge variant="outline">First-time only</Badge>
                  )}

                  {coupon.validUntil && (
                    <Badge variant="outline">
                      Expires {formatDistanceToNow(coupon.validUntil, { addSuffix: true })}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{coupon.stats.redemptions} redemptions</span>
                  <span>${(coupon.stats.totalSaved / 100).toFixed(2)} total saved</span>
                </div>
              </div>

              {coupon.isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => deactivateCoupon(coupon.id)}
                  disabled={deactivating === coupon.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export function CreateCouponForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [validDays, setValidDays] = useState('');
  const [firstTimeOnly, setFirstTimeOnly] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase(),
          description,
          discountType,
          discountValue: discountType === 'percent'
            ? parseInt(discountValue)
            : Math.round(parseFloat(discountValue) * 100), // Convert dollars to cents
          maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : null,
          validDays: validDays ? parseInt(validDays) : null,
          firstTimeOnly,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create coupon');
      }

      toast.success(`Coupon "${code.toUpperCase()}" created!`);

      // Reset form
      setCode('');
      setDescription('');
      setDiscountValue('');
      setMaxRedemptions('');
      setValidDays('');

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create coupon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create Coupon
        </CardTitle>
        <CardDescription>
          Create a new discount coupon code
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Coupon Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g., WELCOME20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Welcome discount for new users"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="discountType">Discount Type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountValue">
                {discountType === 'percent' ? 'Percent Off' : 'Amount ($)'}
              </Label>
              <Input
                id="discountValue"
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? 'e.g., 20' : 'e.g., 5.00'}
                min="0"
                max={discountType === 'percent' ? '100' : undefined}
                step={discountType === 'percent' ? '1' : '0.01'}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maxRedemptions">Max Redemptions</Label>
              <Input
                id="maxRedemptions"
                type="number"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Unlimited"
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="validDays">Valid for (days)</Label>
              <Input
                id="validDays"
                type="number"
                value={validDays}
                onChange={(e) => setValidDays(e.target.value)}
                placeholder="Forever"
                min="1"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="firstTimeOnly">First-time only</Label>
              <p className="text-xs text-muted-foreground">
                Limit to new subscribers
              </p>
            </div>
            <Switch
              id="firstTimeOnly"
              checked={firstTimeOnly}
              onCheckedChange={setFirstTimeOnly}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Coupon'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

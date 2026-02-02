import { getAllCoupons, getCouponStats } from '@/lib/billing/coupons';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { CouponList } from './coupon-list';
import { CreateCouponForm } from './create-coupon-form';

export default async function AdminCouponsPage() {
  // Only platform super admins can manage coupons
  await requireSuperAdmin();

  const coupons = await getAllCoupons();

  // Fetch stats for each coupon
  const couponsWithStats = await Promise.all(
    coupons.map(async (coupon) => {
      const stats = await getCouponStats(coupon.id);
      return { ...coupon, stats };
    })
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Coupons</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage discount coupons
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CreateCouponForm />
        </div>
        <div className="lg:col-span-2">
          <CouponList coupons={couponsWithStats} />
        </div>
      </div>
    </div>
  );
}

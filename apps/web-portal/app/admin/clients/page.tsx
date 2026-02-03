'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Building2, Plus, Edit, Trash2, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ClientProfile {
  id: string;
  companyName: string;
  domain: string | null;
  servicesProvided: string[] | null;
  contractDetails: string | null;
  accountManager: string | null;
  relationshipStatus: string | null;
  lifetimeValue: number | null;
  startDate: string | null;
  renewalDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientContact {
  id: string;
  clientProfileId: string;
  workspaceId: string;
  slackUserId: string;
  slackUserName: string | null;
  role: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === 'active') {
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
  }
  if (status === 'at_risk') {
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">At Risk</Badge>;
  }
  if (status === 'churned') {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Churned</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export default function ClientsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ClientProfile | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Record<string, ClientContact[]>>({});

  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    domain: '',
    servicesProvided: '',
    contractDetails: '',
    accountManager: '',
    relationshipStatus: 'active',
    startDate: '',
    renewalDate: '',
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/admin/clients');
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async (profileId: string) => {
    if (contacts[profileId]) return; // Already loaded

    try {
      const response = await fetch(`/api/admin/clients/${profileId}/contacts`);
      if (response.ok) {
        const data = await response.json();
        setContacts(prev => ({ ...prev, [profileId]: data.contacts || [] }));
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  };

  const handleSubmit = async () => {
    const payload = {
      companyName: formData.companyName,
      domain: formData.domain || undefined,
      servicesProvided: formData.servicesProvided
        ? formData.servicesProvided.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
      contractDetails: formData.contractDetails || undefined,
      accountManager: formData.accountManager || undefined,
      relationshipStatus: formData.relationshipStatus,
      startDate: formData.startDate || undefined,
      renewalDate: formData.renewalDate || undefined,
    };

    try {
      if (editingProfile) {
        // Update existing profile
        const response = await fetch(`/api/admin/clients/${editingProfile.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await fetchProfiles();
          resetForm();
        }
      } else {
        // Create new profile
        const response = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await fetchProfiles();
          resetForm();
        }
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client profile?')) return;

    try {
      const response = await fetch(`/api/admin/clients/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchProfiles();
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const openEditDialog = (profile: ClientProfile) => {
    setEditingProfile(profile);
    setFormData({
      companyName: profile.companyName,
      domain: profile.domain || '',
      servicesProvided: profile.servicesProvided?.join(', ') || '',
      contractDetails: profile.contractDetails || '',
      accountManager: profile.accountManager || '',
      relationshipStatus: profile.relationshipStatus || 'active',
      startDate: profile.startDate ? profile.startDate.split('T')[0] : '',
      renewalDate: profile.renewalDate ? profile.renewalDate.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      companyName: '',
      domain: '',
      servicesProvided: '',
      contractDetails: '',
      accountManager: '',
      relationshipStatus: 'active',
      startDate: '',
      renewalDate: '',
    });
    setEditingProfile(null);
    setDialogOpen(false);
  };

  const toggleExpanded = (profileId: string) => {
    if (expandedProfile === profileId) {
      setExpandedProfile(null);
    } else {
      setExpandedProfile(profileId);
      fetchContacts(profileId);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Client Profiles</h1>
          <p className="text-muted-foreground mt-1">
            Manage your client relationships and contacts
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingProfile(null); resetForm(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProfile ? 'Edit Client Profile' : 'Add Client Profile'}</DialogTitle>
              <DialogDescription>
                {editingProfile ? 'Update client information' : 'Create a new client profile'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="acme.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="servicesProvided">Services Provided (comma-separated)</Label>
                <Input
                  id="servicesProvided"
                  value={formData.servicesProvided}
                  onChange={(e) => setFormData({ ...formData, servicesProvided: e.target.value })}
                  placeholder="Web Development, Consulting"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractDetails">Contract Details (max 2000 chars)</Label>
                <Textarea
                  id="contractDetails"
                  value={formData.contractDetails}
                  onChange={(e) => setFormData({ ...formData, contractDetails: e.target.value })}
                  placeholder="Contract terms, SLAs, special agreements..."
                  maxLength={2000}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountManager">Account Manager</Label>
                  <Input
                    id="accountManager"
                    value={formData.accountManager}
                    onChange={(e) => setFormData({ ...formData, accountManager: e.target.value })}
                    placeholder="Slack User ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationshipStatus">Relationship Status</Label>
                  <Select
                    value={formData.relationshipStatus}
                    onValueChange={(value) => setFormData({ ...formData, relationshipStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                      <SelectItem value="churned">Churned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renewalDate">Renewal Date</Label>
                  <Input
                    id="renewalDate"
                    type="date"
                    value={formData.renewalDate}
                    onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.companyName}>
                {editingProfile ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Clients</CardTitle>
          <CardDescription>
            {profiles.length === 0
              ? 'No client profiles found'
              : `${profiles.length} client profile(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No client profiles"
              description="Add your first client profile to start tracking relationships and contacts."
            />
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="border rounded-lg bg-background">
                  <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-muted rounded-lg">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{profile.companyName}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          {profile.domain && <span>{profile.domain}</span>}
                          {profile.domain && profile.servicesProvided && <span>•</span>}
                          {profile.servicesProvided && (
                            <span>{profile.servicesProvided.slice(0, 2).join(', ')}</span>
                          )}
                          {profile.renewalDate && (
                            <>
                              <span>•</span>
                              <span>Renews: {new Date(profile.renewalDate).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={profile.relationshipStatus} />
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(profile.id)}
                      >
                        {expandedProfile === profile.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(profile)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(profile.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {expandedProfile === profile.id && (
                    <div className="border-t p-4 bg-muted/30">
                      <div className="space-y-3">
                        {profile.contractDetails && (
                          <div>
                            <p className="text-sm font-medium text-foreground mb-1">Contract Details</p>
                            <p className="text-sm text-muted-foreground">{profile.contractDetails}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Contacts ({contacts[profile.id]?.length || 0})
                          </p>
                          {contacts[profile.id] && contacts[profile.id].length > 0 ? (
                            <div className="space-y-2">
                              {contacts[profile.id].map((contact) => (
                                <div
                                  key={contact.id}
                                  className="flex items-center justify-between p-2 bg-background rounded border"
                                >
                                  <div>
                                    <p className="text-sm font-medium">
                                      {contact.slackUserName || contact.slackUserId}
                                    </p>
                                    {contact.role && (
                                      <p className="text-xs text-muted-foreground">{contact.role}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No contacts added yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

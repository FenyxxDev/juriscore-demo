import type { OrganizationLawyer } from "../data"
import { supabase } from "./supabase"

export type OrganizationSummary = {
  id: string
  name: string
  role: "owner" | "member"
}

export type IncomingOrganizationInvite = {
  id: string
  organizationId: string
  organizationName: string
  invitedEmail: string
  createdAt: string
  expiresAt: string
}

export type OutgoingOrganizationInvite = {
  id: string
  invitedEmail: string
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
  declinedAt: string | null
  revokedAt: string | null
}

export type OrganizationPageData = {
  organization: OrganizationSummary | null
  incomingInvites: IncomingOrganizationInvite[]
  outgoingInvites: OutgoingOrganizationInvite[]
}

function client() {
  if (!supabase) throw new Error("O Supabase não está configurado.")
  return supabase
}

function nestedName(value: unknown): string {
  const relation = Array.isArray(value) ? value[0] : value
  if (!relation || typeof relation !== "object") return ""
  const name = (relation as { name?: unknown }).name
  return typeof name === "string" ? name : ""
}

export async function listOrganizationLawyers(): Promise<OrganizationLawyer[]> {
  const { data, error } = await client().rpc("list_organization_lawyers")
  if (error) throw error
  return (data ?? []).map(
    (row: {
      organization_id: string
      organization_name: string
      user_id: string
      nome: string
      email: string
      oab: string
      areas: string[] | null
    }) => ({
      id: row.user_id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      nome: row.nome,
      email: row.email,
      oab: row.oab ?? "",
      areas: Array.isArray(row.areas) ? row.areas : [],
      ativo: true,
    }),
  )
}

export async function loadOrganizationPageData(
  email: string,
): Promise<OrganizationPageData> {
  const api = client()
  const normalizedEmail = email.trim().toLowerCase()
  const [membershipResult, incomingResult] = await Promise.all([
    api
      .from("organization_members")
      .select("organization_id, role, organization:organizations(id, name)")
      .limit(1)
      .maybeSingle(),
    normalizedEmail
      ? api
          .from("organization_invites")
          .select(
            "id, organization_id, invited_email, created_at, expires_at, organization:organizations(name)",
          )
          .eq("invited_email", normalizedEmail)
          .is("accepted_at", null)
          .is("declined_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (membershipResult.error) throw membershipResult.error
  if (incomingResult.error) throw incomingResult.error

  const membership = membershipResult.data as unknown as {
    organization_id: string
    role: "owner" | "member"
    organization: unknown
  } | null
  const organizationRelation = Array.isArray(membership?.organization)
    ? membership.organization[0] as { id?: string; name?: string } | undefined
    : membership?.organization as { id?: string; name?: string } | null
  const organization =
    membership && organizationRelation?.id && organizationRelation.name
      ? {
          id: organizationRelation.id,
          name: organizationRelation.name,
          role: membership.role,
        }
      : null

  const incomingInvites = ((incomingResult.data ?? []) as unknown as Array<{
    id: string
    organization_id: string
    invited_email: string
    created_at: string
    expires_at: string
    organization: unknown
  }>).map((invite) => ({
    id: invite.id,
    organizationId: invite.organization_id,
    organizationName: nestedName(invite.organization) || "Organização",
    invitedEmail: invite.invited_email,
    createdAt: invite.created_at,
    expiresAt: invite.expires_at,
  }))

  let outgoingInvites: OutgoingOrganizationInvite[] = []
  if (organization?.role === "owner") {
    const { data, error } = await api
      .from("organization_invites")
      .select(
        "id, invited_email, created_at, expires_at, accepted_at, declined_at, revoked_at",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) throw error
    outgoingInvites = ((data ?? []) as Array<{
      id: string
      invited_email: string
      created_at: string
      expires_at: string
      accepted_at: string | null
      declined_at: string | null
      revoked_at: string | null
    }>).map((invite) => ({
      id: invite.id,
      invitedEmail: invite.invited_email,
      createdAt: invite.created_at,
      expiresAt: invite.expires_at,
      acceptedAt: invite.accepted_at,
      declinedAt: invite.declined_at,
      revokedAt: invite.revoked_at,
    }))
  }
  return { organization, incomingInvites, outgoingInvites }
}

export async function createOrganization(name: string): Promise<void> {
  const { error } = await client().rpc("create_organization", { p_name: name })
  if (error) throw error
}

export async function createOrganizationInvite(email: string): Promise<void> {
  const { error } = await client().rpc("create_organization_invite", {
    p_email: email,
  })
  if (error) throw error
}

export async function acceptOrganizationInvite(
  inviteId: string,
): Promise<void> {
  const { error } = await client().rpc("accept_organization_invite", {
    p_invite_id: inviteId,
  })
  if (error) throw error
}

export async function declineOrganizationInvite(
  inviteId: string,
): Promise<void> {
  const { error } = await client().rpc("decline_organization_invite", {
    p_invite_id: inviteId,
  })
  if (error) throw error
}

export async function revokeOrganizationInvite(
  inviteId: string,
): Promise<void> {
  const { error } = await client().rpc("revoke_organization_invite", {
    p_invite_id: inviteId,
  })
  if (error) throw error
}

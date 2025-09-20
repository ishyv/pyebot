import { CHANNELS_ID } from "@/constants/guild";

export type CoreChannelName =
  | "messageLogs"
  | "voiceLogs"
  | "ticketLogs"
  | "pointsLog"
  | "generalLogs"
  | "banSanctions"
  | "staff";

export interface CoreChannelDefinition {
  name: CoreChannelName;
  label: string;
  defaultChannelId: string;
}

/**
 * Catalogo central de canales obligatorios: alinea la configuracion en DB
 * con los identificadores fijos definidos en CHANNELS_ID.
 */
export const CORE_CHANNEL_DEFINITIONS: readonly CoreChannelDefinition[] = [
  {
    name: "messageLogs",
    label: "Registro de mensajes moderados",
    defaultChannelId: CHANNELS_ID.messageLogs,
  },
  {
    name: "voiceLogs",
    label: "Registro de actividad en voz",
    defaultChannelId: CHANNELS_ID.voiceLogs,
  },
  {
    name: "ticketLogs",
    label: "Seguimiento de tickets",
    defaultChannelId: CHANNELS_ID.ticketLogs,
  },
  {
    name: "pointsLog",
    label: "Bitacora de puntos",
    defaultChannelId: CHANNELS_ID.pointsLog,
  },
  {
    name: "generalLogs",
    label: "Eventos generales del servidor",
    defaultChannelId: CHANNELS_ID.generalLogs,
  },
  {
    name: "banSanctions",
    label: "Historial de sanciones",
    defaultChannelId: CHANNELS_ID.banSanctions,
  },
  {
    name: "staff",
    label: "Alertas para el staff",
    defaultChannelId: CHANNELS_ID.staff,
  },
] as const;

/** Acceso rapido a la etiqueta humana que se muestra en embeds/logs. */
export const CORE_CHANNEL_LABELS: Record<CoreChannelName, string> = Object.fromEntries(
  CORE_CHANNEL_DEFINITIONS.map((definition) => [definition.name, definition.label]),
) as Record<CoreChannelName, string>;





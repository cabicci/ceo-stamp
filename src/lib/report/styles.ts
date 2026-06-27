import { StyleSheet } from "@react-pdf/renderer";
import type { ReportBuildContext } from "./types";

export const LEDGER = {
  paper: "#FFFFFF",
  surface: "#FAFAF8",
  ink: "#1A1B1F",
  muted: "#6B6E76",
  accent: "#F5D547",
  hairline: "#E8E6E1",
} as const;

export function createReportStyles(ctx: ReportBuildContext) {
  const rtl = ctx.isRtl;
  return StyleSheet.create({
    page: {
      fontFamily: "Cairo",
      fontSize: 10,
      lineHeight: 1.55,
      color: LEDGER.ink,
      backgroundColor: LEDGER.paper,
      paddingTop: 72,
      paddingBottom: 56,
      paddingHorizontal: 40,
    },
    header: {
      position: "absolute",
      top: 24,
      left: 40,
      right: 40,
      flexDirection: rtl ? "row-reverse" : "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingBottom: 10,
    },
    headerRule: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 1,
      backgroundColor: LEDGER.hairline,
    },
    headerAccent: {
      width: 28,
      height: 3,
      backgroundColor: LEDGER.accent,
      marginBottom: 6,
    },
    headerBrandBlock: {
      alignItems: rtl ? "flex-end" : "flex-start",
      maxWidth: "55%",
    },
    projectName: {
      fontSize: 14,
      fontWeight: 600,
      textAlign: rtl ? "right" : "left",
    },
    projectUrl: {
      fontSize: 8,
      color: LEDGER.muted,
      marginTop: 2,
      textAlign: rtl ? "right" : "left",
    },
    wordmark: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.4,
      textAlign: rtl ? "left" : "right",
    },
    wordmarkDot: {
      color: LEDGER.accent,
    },
    footer: {
      position: "absolute",
      bottom: 20,
      left: 40,
      right: 40,
      flexDirection: rtl ? "row-reverse" : "row",
      justifyContent: "space-between",
      paddingTop: 8,
      fontSize: 8,
      color: LEDGER.muted,
    },
    footerRule: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 1,
      backgroundColor: LEDGER.hairline,
    },
    sectionHeading: {
      marginTop: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 600,
      textAlign: rtl ? "right" : "left",
      paddingBottom: 6,
    },
    sectionTitleRule: {
      height: 2,
      backgroundColor: LEDGER.accent,
    },
    fieldBlock: {
      marginBottom: 10,
    },
    fieldLabel: {
      fontSize: 8,
      fontWeight: 600,
      color: LEDGER.muted,
      marginBottom: 3,
      textAlign: rtl ? "right" : "left",
      letterSpacing: 0.6,
    },
    fieldBody: {
      fontSize: 10,
      textAlign: rtl ? "right" : "left",
    },
    bulletList: {
      marginTop: 2,
    },
    bulletItem: {
      flexDirection: rtl ? "row-reverse" : "row",
      marginBottom: 3,
      gap: 6,
    },
    bulletGlyph: {
      fontSize: 10,
      color: LEDGER.accent,
      width: 10,
      textAlign: "center",
    },
    bulletText: {
      flex: 1,
      fontSize: 10,
      textAlign: rtl ? "right" : "left",
    },
    personaCard: {
      backgroundColor: LEDGER.surface,
      padding: 8,
      marginBottom: 8,
    },
    personaName: {
      fontSize: 11,
      fontWeight: 600,
      marginBottom: 6,
      textAlign: rtl ? "right" : "left",
    },
    subLabel: {
      fontSize: 8,
      color: LEDGER.muted,
      marginBottom: 2,
      marginTop: 4,
      textAlign: rtl ? "right" : "left",
    },
    emptyNote: {
      fontSize: 9,
      color: LEDGER.muted,
      fontStyle: "italic",
      textAlign: rtl ? "right" : "left",
    },
    postCard: {
      backgroundColor: LEDGER.surface,
      padding: 10,
      marginBottom: 12,
    },
    postMeta: {
      fontSize: 8,
      color: LEDGER.muted,
      marginBottom: 6,
      textAlign: rtl ? "right" : "left",
    },
    postImage: {
      width: 220,
      height: 220,
      objectFit: "contain",
      marginTop: 8,
      marginBottom: 4,
      alignSelf: rtl ? "flex-end" : "flex-start",
    },
    adCard: {
      backgroundColor: LEDGER.surface,
      padding: 10,
      marginBottom: 10,
    },
  });
}

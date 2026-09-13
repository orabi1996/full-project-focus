import { useAuth } from "../../auth/AuthContext";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { useDemoStore } from "../demo/demo-store";

export function useIntegrations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoJournals = useDemoStore((s) => s.accountingJournals);

  const accountingJournals = isLive ? bootstrap.accountingJournals : demoJournals;

  return {
    accountingJournals,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

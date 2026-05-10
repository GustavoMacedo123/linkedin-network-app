import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NetworkStats } from "@/components/NetworkStats";
import { useStore } from "@/state/store";
import type { PersonNode } from "@/state/store";

const make = (id: number, company: string | null, archived = false): PersonNode => ({
  id, first_name: "F", last_name: "L", company, title: null, archived, tagIds: [],
});

describe("NetworkStats", () => {
  beforeEach(() => {
    useStore.setState({ persons: [] });
  });

  it("renders nothing when there are no non-archived connections", () => {
    const { container } = render(<NetworkStats />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when every person is archived", () => {
    useStore.setState({ persons: [make(1, "Google", true)] });
    const { container } = render(<NetworkStats />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders all three stats when at least one connection has a company", () => {
    useStore.setState({
      persons: [make(1, "Google"), make(2, "Google"), make(3, "Stripe")],
    });
    render(<NetworkStats />);
    expect(screen.getByText(/3 connections/)).toBeInTheDocument();
    expect(screen.getByText(/Top: Google \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/2 companies/)).toBeInTheDocument();
  });

  it("omits the top + company-count segments when nobody has a company set", () => {
    useStore.setState({ persons: [make(1, null), make(2, "")] });
    render(<NetworkStats />);
    expect(screen.getByText(/2 connections/)).toBeInTheDocument();
    expect(screen.queryByText(/Top:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/compan(y|ies)/)).not.toBeInTheDocument();
  });

  it("uses singular forms for counts of 1", () => {
    useStore.setState({ persons: [make(1, "Google")] });
    render(<NetworkStats />);
    expect(screen.getByText(/^1 connection\b.*\b1 company$/)).toBeInTheDocument();
  });
});

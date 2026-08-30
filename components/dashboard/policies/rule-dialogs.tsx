"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  createRule,
  deleteRule,
  updateRule,
  type RuleInput,
} from "@/app/dashboard/policies/actions"

const EMPTY: RuleInput = {
  code: "",
  category: "payment_terms",
  description: "",
  keywords: "",
  severity: "major",
}

const CATEGORIES = [
  { value: "payment_terms", label: "Payment terms" },
  { value: "liability", label: "Liability" },
  { value: "delivery", label: "Delivery & SLA" },
  { value: "termination", label: "Termination" },
  { value: "pricing", label: "Pricing" },
  { value: "warranty", label: "Warranty" },
  { value: "legal", label: "Legal" },
]

export function CreateRuleDialog() {
  const [open, setOpen] = useState(false)
  return (
    <RuleFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button>
          <PlusIcon data-icon="inline-start" />
          New rule
        </Button>
      }
      title="Create policy rule"
      description="Add a rule to the procurement rulebook. Keywords power the baseline keyword checker; the agent judges intent."
      submitLabel="Create rule"
    />
  )
}

export function EditRuleDialog({
  rule,
}: {
  rule: {
    id: string
    code: string
    category: string
    description: string
    keywords: string[]
    severity: string
  }
}) {
  return (
    <RuleFormDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${rule.code}`}>
          <PencilIcon />
        </Button>
      }
      title={`Edit ${rule.code}`}
      description="Update the rule definition."
      submitLabel="Save changes"
      initial={{
        code: rule.code,
        category: rule.category,
        description: rule.description,
        keywords: rule.keywords.join(", "),
        severity: rule.severity as RuleInput["severity"],
      }}
      ruleId={rule.id}
    />
  )
}

export function DeleteRuleButton({ id, code }: { id: string; code: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Delete ${code}`}
      disabled={pending}
      onClick={() => startTransition(() => deleteRule(id))}
    >
      {pending ? <Spinner /> : <Trash2Icon />}
    </Button>
  )
}

function RuleFormDialog({
  trigger,
  title,
  description,
  submitLabel,
  initial,
  ruleId,
  open,
  onOpenChange,
}: {
  trigger: React.ReactElement
  title: string
  description: string
  submitLabel: string
  initial?: RuleInput
  ruleId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<RuleInput>(initial ?? EMPTY)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isOpen = open ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  function submit() {
    setError(null)
    if (!form.code.trim() || !form.description.trim()) {
      setError("Code and description are required.")
      return
    }
    startTransition(async () => {
      try {
        if (ruleId) await updateRule(ruleId, form)
        else await createRule(form)
        setForm(EMPTY)
        setOpen(false)
        router.refresh()
      } catch {
        setError("Could not save the rule. The code may already exist.")
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="rule-code">Code</FieldLabel>
              <Input
                id="rule-code"
                value={form.code}
                placeholder="R-13"
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rule-severity">Severity</FieldLabel>
              <Select
                items={[
                  { value: "critical", label: "Critical" },
                  { value: "major", label: "Major" },
                  { value: "minor", label: "Minor" },
                ]}
                value={form.severity}
                onValueChange={(v) =>
                  setForm({ ...form, severity: (v ?? "major") as RuleInput["severity"] })
                }
              >
                <SelectTrigger id="rule-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="rule-category">Category</FieldLabel>
              <Select
                items={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v ?? "payment_terms" })
                }
              >
              <SelectTrigger id="rule-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rule-description">Description</FieldLabel>
            <Textarea
              id="rule-description"
              value={form.description}
              placeholder="Payment terms must not exceed 30 days."
              rows={2}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rule-keywords">Baseline keywords</FieldLabel>
            <Textarea
              id="rule-keywords"
              value={form.keywords}
              placeholder={"net 30, 30 days"}
              rows={2}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            />
            <FieldDescription>
              Comma-separated. The baseline checker passes a document when any
              keyword appears; the agent is not limited by them.
            </FieldDescription>
          </Field>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

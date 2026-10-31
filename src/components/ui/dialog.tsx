"use client"

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

// Shared styling for Dialog and AlertDialog, whose parts are the same shape.

const backdropClass = "fixed inset-0 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"

const popupClass =
  "fixed top-1/2 left-1/2 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border bg-background p-5 shadow-lg"

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={backdropClass} />
      <DialogPrimitive.Popup className={cn(popupClass, className)} {...props}>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function AlertDialogContent({ className, children, ...props }: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className={backdropClass} />
      <AlertDialogPrimitive.Popup className={cn(popupClass, className)} {...props}>
        {children}
      </AlertDialogPrimitive.Popup>
    </AlertDialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
}

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return <AlertDialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
}

const Dialog = DialogPrimitive.Root
const DialogClose = DialogPrimitive.Close
const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogDescription = AlertDialogPrimitive.Description
const AlertDialogClose = AlertDialogPrimitive.Close

export {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
}

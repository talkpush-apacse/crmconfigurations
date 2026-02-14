"use client";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { AlertCircle, CheckCircle, Edit3 } from "lucide-react";

export function ReadMeSheet() {
  return (
    <div>
      <SectionHeader title="Read Me - How To Use" />
      <div className="space-y-6 rounded-lg border bg-white p-8">
        <div className="flex items-start gap-4 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4">
          <Edit3 className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
          <div>
            <h3 className="font-semibold text-yellow-800">Editable Fields</h3>
            <p className="mt-1 text-sm text-yellow-700">
              Fields with a yellow background are editable. Click on them to enter your information.
              Your changes are saved automatically.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-lg border-l-4 border-green-400 bg-green-50 p-4">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-800">Auto-Save</h3>
            <p className="mt-1 text-sm text-green-700">
              All changes are automatically saved 2 seconds after you stop typing.
              The save status is shown in the top-right corner of the header.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <h3 className="font-semibold text-blue-800">Important Notes</h3>
            <ul className="mt-1 space-y-1 text-sm text-blue-700">
              <li>Do not skip sections — complete each tab in order when possible.</li>
              <li>Dropdown fields have predefined options — select from the list.</li>
              <li>For tables, use the &quot;Add Row&quot; button to create new entries.</li>
              <li>You can delete rows using the trash icon on the right side.</li>
              <li>Hover over column headers for detailed descriptions.</li>
              <li>Export your completed checklist using the &quot;Export XLS&quot; button in the header.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

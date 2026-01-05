import { CanDeactivateFn } from '@angular/router';
import { HasUnsavedChanges } from '../../features/posts/data-access/post.model';

export const pendingChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  
  if(component.hasUnsavedChanges()) 
    return confirm('You have unsaved changes. Do you really want toleave?');

  return true;
};

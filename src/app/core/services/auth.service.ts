import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from '@angular/fire/auth';
import { doc, Firestore, setDoc } from '@angular/fire/firestore';
import { user } from 'rxfire/auth';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // user$: Observable<User | null>;
  private currentUserSubject = new BehaviorSubject<User | null>(null);

  constructor(private auth: Auth, private firestore: Firestore) {
    user(this.auth).subscribe((user) => {
      this.currentUserSubject.next(user);
    });
  }

  get isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  async signup(email: string, password: string, name: string) {
    const userCredential = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );

    return new Promise<void>((resolve, reject) => {
      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          try {
            await setDoc(doc(this.firestore, 'users', user.uid), {
              email: user.email,
              name: name,
              role: 'user',
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          reject('User is not authenticated');
        }
      });
    });
    
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    return signOut(this.auth);
  }
}

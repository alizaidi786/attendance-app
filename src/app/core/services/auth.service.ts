import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
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
    const uid = userCredential.user.uid;

    // Save user details and role to Firestore
    await setDoc(doc(this.firestore, 'users', uid), {
      email: email,
      name: name,
      role: 'user',
    });
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    return signOut(this.auth);
  }
}
